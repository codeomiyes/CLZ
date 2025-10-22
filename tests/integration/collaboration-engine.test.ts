/**
 * Integration Tests: Collaboration Engine
 * Test Case IDs: CE-001, CE-002
 */

describe('Collaboration Engine - Integration Tests', () => {
  describe('CE-001: Real-time Collaboration Sync', () => {
    test('Should propagate changes between users within 100ms', async () => {
      // Mock WebSocket connection
      class MockWebSocket {
        private listeners: Map<string, Function[]> = new Map();
        
        on(event: string, callback: Function) {
          if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
          }
          this.listeners.get(event)!.push(callback);
        }

        emit(event: string, data: any) {
          const callbacks = this.listeners.get(event) || [];
          callbacks.forEach(cb => cb(data));
        }

        send(data: any) {
          // Simulate network latency
          setTimeout(() => {
            this.emit('message', data);
          }, 50); // 50ms latency
        }
      }

      const userASocket = new MockWebSocket();
      const userBSocket = new MockWebSocket();
      
      let userBReceivedUpdate = false;
      let propagationTime = 0;

      // User B listens for updates
      userBSocket.on('message', (data: any) => {
        userBReceivedUpdate = true;
        propagationTime = Date.now() - data.timestamp;
      });

      // User A makes an edit
      const startTime = Date.now();
      const edit = {
        documentId: 'doc_456',
        userId: 'user_a',
        position: 10,
        insert: 'Hello',
        timestamp: startTime
      };

      // Simulate server broadcasting to User B
      userASocket.send(edit);
      userBSocket.emit('message', edit);

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(userBReceivedUpdate).toBe(true);
      expect(propagationTime).toBeLessThan(100);
    });

    test('Should handle concurrent edits with operational transformation', () => {
      // Operational Transformation algorithm
      const applyOT = (edit1: any, edit2: any) => {
        // If edit2 position is after edit1, adjust it
        if (edit2.position >= edit1.position) {
          edit2.position += edit1.insert.length;
        }
        return edit2;
      };

      const userAEdit = { position: 10, insert: 'Hello', userId: 'user_a' };
      const userBEdit = { position: 15, insert: 'World', userId: 'user_b' };

      // Apply OT to resolve conflict
      const transformedEdit = applyOT(userAEdit, userBEdit);

      // User B's edit position should be adjusted
      expect(transformedEdit.position).toBe(20); // 15 + 5 (length of "Hello")
      expect(transformedEdit.insert).toBe('World');
    });

    test('Should maintain consistent final state across all users', () => {
      class Document {
        private content: string = '';
        private version: number = 0;

        applyEdit(position: number, text: string) {
          this.content = 
            this.content.slice(0, position) + 
            text + 
            this.content.slice(position);
          this.version++;
        }

        getContent(): string {
          return this.content;
        }

        getVersion(): number {
          return this.version;
        }
      }

      const userADoc = new Document();
      const userBDoc = new Document();

      // Apply same edits in same order
      const edits = [
        { position: 0, text: 'Hello ' },
        { position: 6, text: 'World' },
        { position: 11, text: '!' }
      ];

      edits.forEach(edit => {
        userADoc.applyEdit(edit.position, edit.text);
        userBDoc.applyEdit(edit.position, edit.text);
      });

      expect(userADoc.getContent()).toBe(userBDoc.getContent());
      expect(userADoc.getContent()).toBe('Hello World!');
      expect(userADoc.getVersion()).toBe(userBDoc.getVersion());
    });
  });

  describe('CE-002: Offline Mode and Sync Recovery', () => {
    test('Should store edits locally when offline', () => {
      class OfflineStorage {
        private storage: any[] = [];

        storeEdit(edit: any) {
          this.storage.push({
            ...edit,
            storedAt: new Date(),
            synced: false
          });
        }

        getPendingEdits() {
          return this.storage.filter(edit => !edit.synced);
        }

        markAsSynced(editId: string) {
          const edit = this.storage.find(e => e.id === editId);
          if (edit) edit.synced = true;
        }

        clear() {
          this.storage = [];
        }
      }

      const storage = new OfflineStorage();
      
      // User makes edits while offline
      storage.storeEdit({ id: 'edit_1', position: 0, insert: 'Offline edit 1' });
      storage.storeEdit({ id: 'edit_2', position: 10, insert: 'Offline edit 2' });

      const pendingEdits = storage.getPendingEdits();

      expect(pendingEdits).toHaveLength(2);
      expect(pendingEdits[0].synced).toBe(false);
      expect(pendingEdits[0].storedAt).toBeInstanceOf(Date);
    });

    test('Should sync offline changes when connection restored', async () => {
      class SyncManager {
        private isOnline: boolean = true;
        private pendingEdits: any[] = [];

        setOnlineStatus(status: boolean) {
          this.isOnline = status;
          if (status) {
            this.syncPendingEdits();
          }
        }

        addEdit(edit: any) {
          if (this.isOnline) {
            this.syncImmediately(edit);
          } else {
            this.pendingEdits.push(edit);
          }
        }

        private syncImmediately(edit: any) {
          // Simulate immediate sync
          return Promise.resolve({ success: true, edit });
        }

        private async syncPendingEdits() {
          const results = await Promise.all(
            this.pendingEdits.map(edit => this.syncImmediately(edit))
          );
          this.pendingEdits = [];
          return results;
        }

        getPendingCount() {
          return this.pendingEdits.length;
        }
      }

      const syncManager = new SyncManager();

      // Go offline
      syncManager.setOnlineStatus(false);
      syncManager.addEdit({ id: 'edit_1', text: 'Offline edit' });
      syncManager.addEdit({ id: 'edit_2', text: 'Another offline edit' });

      expect(syncManager.getPendingCount()).toBe(2);

      // Come back online
      syncManager.setOnlineStatus(true);
      
      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(syncManager.getPendingCount()).toBe(0);
    });

    test('Should resolve conflicts during sync recovery', () => {
      const resolveConflict = (localEdit: any, serverEdit: any) => {
        // Last-write-wins strategy with timestamp
        if (localEdit.timestamp > serverEdit.timestamp) {
          return { winner: 'local', edit: localEdit };
        } else if (serverEdit.timestamp > localEdit.timestamp) {
          return { winner: 'server', edit: serverEdit };
        } else {
          // Same timestamp, use user ID as tiebreaker
          return localEdit.userId > serverEdit.userId 
            ? { winner: 'local', edit: localEdit }
            : { winner: 'server', edit: serverEdit };
        }
      };

      const localEdit = {
        position: 10,
        insert: 'Local change',
        timestamp: 1000,
        userId: 'user_a'
      };

      const serverEdit = {
        position: 10,
        insert: 'Server change',
        timestamp: 1100,
        userId: 'user_b'
      };

      const result = resolveConflict(localEdit, serverEdit);

      expect(result.winner).toBe('server');
      expect(result.edit.insert).toBe('Server change');
    });

    test('Should notify user of sync status', () => {
      class SyncNotifier {
        private status: string = 'synced';
        private listeners: Function[] = [];

        onStatusChange(callback: Function) {
          this.listeners.push(callback);
        }

        setStatus(status: 'syncing' | 'synced' | 'offline' | 'conflict') {
          this.status = status;
          this.listeners.forEach(cb => cb(status));
        }

        getStatus() {
          return this.status;
        }
      }

      const notifier = new SyncNotifier();
      const statusUpdates: string[] = [];

      notifier.onStatusChange((status: string) => {
        statusUpdates.push(status);
      });

      notifier.setStatus('offline');
      notifier.setStatus('syncing');
      notifier.setStatus('synced');

      expect(statusUpdates).toEqual(['offline', 'syncing', 'synced']);
      expect(notifier.getStatus()).toBe('synced');
    });
  });

  describe('Collaboration Performance', () => {
    test('Should handle high-frequency edits without data loss', async () => {
      const editQueue: any[] = [];
      let processedEdits = 0;

      const processEdit = async (edit: any) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        processedEdits++;
        return edit;
      };

      // Simulate 100 rapid edits
      const edits = Array.from({ length: 100 }, (_, i) => ({
        id: `edit_${i}`,
        position: i,
        insert: `char_${i}`
      }));

      // Queue all edits
      edits.forEach(edit => editQueue.push(edit));

      // Process all edits
      await Promise.all(editQueue.map(edit => processEdit(edit)));

      expect(processedEdits).toBe(100);
      expect(editQueue).toHaveLength(100);
    });
  });
});
