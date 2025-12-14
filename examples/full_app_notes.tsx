/**
 * Willow React Hooks - Full Notes Application Example
 *
 * A complete, production-ready notes application demonstrating:
 * 1. Authentication flow (generate DID, login/logout)
 * 2. First-run setup (app registration, subgrove creation)
 * 3. Balance checking before operations
 * 4. Full CRUD operations on notes
 * 5. Search and filtering
 * 6. Real-time data refresh
 * 7. Error handling patterns
 *
 * This example shows how all Willow React hooks work together
 * in a real-world application.
 *
 * Prerequisites:
 * - npm install @willow/react-hooks @willow/sdk
 * - Run a local Willow node with funding
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  WillowProvider,
  useWillow,
  useAuth,
  useRegistration,
  useApp,
  useCollection,
  useQuery,
  useBalance,
  useAppBalance,
  useToken,
} from '@willow/react-hooks';

// ============ TYPES ============

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  created: number;
  updated: number;
  pinned: boolean;
}

type AppState = 'loading' | 'unauthenticated' | 'setup' | 'ready';

// ============ CONSTANTS ============

const APP_ID = 'willow-notes-app';
const COLLECTION = 'notes';
const CATEGORIES = ['personal', 'work', 'ideas', 'archive'];

// ============ STYLES ============

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    minHeight: '100vh',
    background: '#f5f5f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '15px 20px',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    color: '#333',
  },
  button: {
    padding: '8px 16px',
    fontSize: '14px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryButton: {
    background: '#1976d2',
    color: '#fff',
  },
  secondaryButton: {
    background: '#e0e0e0',
    color: '#333',
  },
  dangerButton: {
    background: '#d32f2f',
    color: '#fff',
  },
  card: {
    background: '#fff',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '15px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    marginBottom: '10px',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    minHeight: '150px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  },
  select: {
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    marginRight: '10px',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: '12px',
    borderRadius: '12px',
    marginRight: '5px',
    background: '#e3f2fd',
    color: '#1976d2',
  },
  noteCard: {
    background: '#fff',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  sidebar: {
    width: '250px',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    marginLeft: '20px',
  },
  grid: {
    display: 'flex',
  },
  statusBar: {
    display: 'flex',
    gap: '15px',
    fontSize: '13px',
    color: '#666',
  },
  error: {
    background: '#ffebee',
    color: '#c62828',
    padding: '10px 15px',
    borderRadius: '6px',
    marginBottom: '15px',
  },
  success: {
    background: '#e8f5e9',
    color: '#2e7d32',
    padding: '10px 15px',
    borderRadius: '6px',
    marginBottom: '15px',
  },
};

// ============ MAIN APP ============

function NotesApp() {
  const { isAuthenticated, session, isLoading: authLoading } = useWillow();
  const { app, isLoading: appLoading } = useApp(APP_ID);

  // Determine app state
  const getAppState = (): AppState => {
    if (authLoading || appLoading) return 'loading';
    if (!isAuthenticated) return 'unauthenticated';
    if (!app) return 'setup';
    return 'ready';
  };

  const appState = getAppState();

  return (
    <div style={styles.container}>
      {appState === 'loading' && <LoadingScreen />}
      {appState === 'unauthenticated' && <LoginScreen />}
      {appState === 'setup' && <SetupScreen did={session!.did} />}
      {appState === 'ready' && <MainApp did={session!.did} />}
    </div>
  );
}

// ============ LOADING SCREEN ============

function LoadingScreen() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '100px' }}>
      <h2>Loading Willow Notes...</h2>
      <p>Connecting to the network</p>
    </div>
  );
}

// ============ LOGIN SCREEN ============

function LoginScreen() {
  const { generateAndRegister, login, isGenerating } = useAuth();
  const [privateKey, setPrivateKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'new' | 'existing'>('new');

  const handleGenerateNew = async () => {
    try {
      setError(null);
      const result = await generateAndRegister();
      // In a real app, prompt user to save their private key securely
      alert(`Save your private key securely!\n\n${result.privateKey}\n\nYou'll need this to log in again.`);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleLogin = async () => {
    try {
      setError(null);
      await login(privateKey);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto' }}>
      <div style={styles.card}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Willow Notes</h1>

        {error && <div style={styles.error}>{error}</div>}

        <div style={{ display: 'flex', marginBottom: '20px' }}>
          <button
            style={{
              ...styles.button,
              flex: 1,
              ...(mode === 'new' ? styles.primaryButton : styles.secondaryButton),
            }}
            onClick={() => setMode('new')}
          >
            New User
          </button>
          <button
            style={{
              ...styles.button,
              flex: 1,
              marginLeft: '10px',
              ...(mode === 'existing' ? styles.primaryButton : styles.secondaryButton),
            }}
            onClick={() => setMode('existing')}
          >
            Existing User
          </button>
        </div>

        {mode === 'new' ? (
          <div>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Generate a new decentralized identity (DID) to start using Willow Notes.
            </p>
            <button
              style={{ ...styles.button, ...styles.primaryButton, width: '100%' }}
              onClick={handleGenerateNew}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate DID & Start'}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Enter your private key to access your notes.
            </p>
            <input
              type="password"
              placeholder="Enter your private key"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              style={styles.input}
            />
            <button
              style={{ ...styles.button, ...styles.primaryButton, width: '100%' }}
              onClick={handleLogin}
              disabled={!privateKey}
            >
              Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SETUP SCREEN ============

function SetupScreen({ did }: { did: string }) {
  const { registerApp, registerDataset, isRegistering, error: regError } = useRegistration();
  const { logout } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async () => {
    try {
      setError(null);

      // Step 1: Register the app
      setStatus('Registering application...');
      await registerApp({
        app_id: APP_ID,
        name: 'Willow Notes',
        description: 'A decentralized notes application powered by Willow',
        app_type: 'web',
        owner_did: did,
        admins: [],
      });

      // Step 2: Create the notes collection with schema
      setStatus('Creating notes collection...');
      await registerDataset({
        dataset_id: COLLECTION,
        app_id: APP_ID,
        name: 'Notes',
        dataset_path: ['collections'],
        schema: {
          version: 1,
          fields: {
            id: { type: 'string', indexed: true, required: true },
            title: { type: 'string', indexed: true, required: true },
            content: { type: 'string', indexed: false },
            category: { type: 'string', indexed: true },
            tags: { type: 'array', indexed: true },
            created: { type: 'number', indexed: true },
            updated: { type: 'number', indexed: true },
            pinned: { type: 'boolean', indexed: true },
          },
          indexes: [
            { name: 'by_category', fields: ['category'], type: 'hash' },
            { name: 'by_created', fields: ['created'], type: 'range' },
            { name: 'by_updated', fields: ['updated'], type: 'range' },
          ],
          required_fields: ['id', 'title'],
        },
        owner_did: did,
        writers: [did],
        readers: [],
      });

      setStatus('Setup complete! Refreshing...');
      // App will automatically transition to 'ready' state when useApp refreshes
      window.location.reload();
    } catch (err) {
      setError(String(err));
      setStatus('');
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '100px auto' }}>
      <div style={styles.card}>
        <h2>Welcome to Willow Notes!</h2>
        <p style={{ color: '#666' }}>
          This appears to be your first time. Let's set up your notes storage on the Willow network.
        </p>

        {error && <div style={styles.error}>{error}</div>}
        {regError && <div style={styles.error}>{regError.message}</div>}
        {status && <div style={styles.success}>{status}</div>}

        <div style={{ marginTop: '20px' }}>
          <button
            style={{ ...styles.button, ...styles.primaryButton, marginRight: '10px' }}
            onClick={handleSetup}
            disabled={isRegistering}
          >
            {isRegistering ? 'Setting up...' : 'Set Up Notes Storage'}
          </button>
          <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={logout}>
            Logout
          </button>
        </div>

        <div style={{ marginTop: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>What happens during setup:</h4>
          <ol style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
            <li>Register your app on the Willow network</li>
            <li>Create a secure, indexed collection for your notes</li>
            <li>Set up cryptographic proofs for data verification</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APPLICATION ============

function MainApp({ did }: { did: string }) {
  const { logout } = useAuth();

  // Balance hooks
  const { balance } = useBalance(did);
  const { balance: appBalance } = useAppBalance(APP_ID);

  // Collection operations
  const { store, update, remove, batchStore } = useCollection(APP_ID, COLLECTION);

  // Query notes
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const queryOptions =
    categoryFilter !== 'all' ? { where: { category: categoryFilter }, limit: 100 } : { limit: 100 };

  const {
    documents: notes,
    isLoading: notesLoading,
    refetch: refetchNotes,
  } = useQuery<Note>(APP_ID, COLLECTION, queryOptions);

  // Local state
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter notes by search term (client-side for simplicity)
  const filteredNotes = notes.filter((note: Note) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      note.title.toLowerCase().includes(term) ||
      note.content.toLowerCase().includes(term) ||
      note.tags.some((tag) => tag.toLowerCase().includes(term))
    );
  });

  // Sort: pinned first, then by updated date
  const sortedNotes = [...filteredNotes].sort((a: Note, b: Note) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updated - a.updated;
  });

  // Show message temporarily
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Create note
  const handleCreate = async (noteData: Partial<Note>) => {
    try {
      const now = Date.now();
      const id = `note-${now}`;
      const newNote: Note = {
        id,
        title: noteData.title || 'Untitled',
        content: noteData.content || '',
        category: noteData.category || 'personal',
        tags: noteData.tags || [],
        created: now,
        updated: now,
        pinned: false,
      };

      await store(id, newNote);
      showMessage('success', 'Note created successfully!');
      setIsCreating(false);
      refetchNotes();
    } catch (err) {
      showMessage('error', `Failed to create note: ${err}`);
    }
  };

  // Update note
  const handleUpdate = async (noteData: Note) => {
    try {
      const updatedNote = { ...noteData, updated: Date.now() };
      await update(noteData.id, updatedNote);
      showMessage('success', 'Note updated!');
      setSelectedNote(updatedNote);
      setIsEditing(false);
      refetchNotes();
    } catch (err) {
      showMessage('error', `Failed to update note: ${err}`);
    }
  };

  // Delete note
  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      await remove(noteId);
      showMessage('success', 'Note deleted');
      setSelectedNote(null);
      refetchNotes();
    } catch (err) {
      showMessage('error', `Failed to delete note: ${err}`);
    }
  };

  // Toggle pin
  const handleTogglePin = async (note: Note) => {
    try {
      const updatedNote = { ...note, pinned: !note.pinned, updated: Date.now() };
      await update(note.id, updatedNote);
      if (selectedNote?.id === note.id) {
        setSelectedNote(updatedNote);
      }
      refetchNotes();
    } catch (err) {
      showMessage('error', `Failed to update note: ${err}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Willow Notes</h1>
        <div style={styles.statusBar}>
          <span>Balance: {balance?.available?.toLocaleString() || 0} WILL</span>
          <span>App Fund: {appBalance?.toLocaleString() || 0} WILL</span>
          <span>Notes: {notes.length}</span>
        </div>
        <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={logout}>
          Logout
        </button>
      </header>

      {/* Messages */}
      {message && (
        <div style={message.type === 'success' ? styles.success : styles.error}>{message.text}</div>
      )}

      {/* Main Layout */}
      <div style={styles.grid}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.card}>
            <button
              style={{ ...styles.button, ...styles.primaryButton, width: '100%', marginBottom: '15px' }}
              onClick={() => {
                setIsCreating(true);
                setSelectedNote(null);
                setIsEditing(false);
              }}
            >
              + New Note
            </button>

            {/* Search */}
            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...styles.input, marginBottom: '15px' }}
            />

            {/* Category Filter */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '5px' }}>
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ ...styles.select, width: '100%' }}
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes List */}
          <div style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
            {notesLoading ? (
              <p style={{ textAlign: 'center', color: '#666' }}>Loading notes...</p>
            ) : sortedNotes.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666' }}>
                {searchTerm ? 'No notes match your search' : 'No notes yet. Create one!'}
              </p>
            ) : (
              sortedNotes.map((note: Note) => (
                <div
                  key={note.id}
                  style={{
                    ...styles.noteCard,
                    borderLeft: selectedNote?.id === note.id ? '3px solid #1976d2' : '3px solid transparent',
                  }}
                  onClick={() => {
                    setSelectedNote(note);
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
                      {note.pinned && '📌 '}
                      {note.title}
                    </h4>
                  </div>
                  <p
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '12px',
                      color: '#666',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {note.content.substring(0, 50) || 'No content'}
                  </p>
                  <div>
                    <span style={{ ...styles.badge, background: '#f5f5f5', color: '#666' }}>
                      {note.category}
                    </span>
                    {note.tags.slice(0, 2).map((tag) => (
                      <span key={tag} style={styles.badge}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main style={styles.main}>
          {isCreating ? (
            <NoteEditor onSave={handleCreate} onCancel={() => setIsCreating(false)} />
          ) : selectedNote ? (
            isEditing ? (
              <NoteEditor
                note={selectedNote}
                onSave={handleUpdate}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <NoteViewer
                note={selectedNote}
                onEdit={() => setIsEditing(true)}
                onDelete={() => handleDelete(selectedNote.id)}
                onTogglePin={() => handleTogglePin(selectedNote)}
              />
            )
          ) : (
            <div style={{ ...styles.card, textAlign: 'center', padding: '60px' }}>
              <h3 style={{ color: '#666' }}>Select a note or create a new one</h3>
              <p style={{ color: '#999' }}>
                Your notes are stored securely on the Willow network with cryptographic proofs.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ============ NOTE VIEWER ============

function NoteViewer({
  note,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>{note.title}</h2>
        <div>
          <button
            style={{ ...styles.button, ...styles.secondaryButton, marginRight: '10px' }}
            onClick={onTogglePin}
          >
            {note.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            style={{ ...styles.button, ...styles.primaryButton, marginRight: '10px' }}
            onClick={onEdit}
          >
            Edit
          </button>
          <button style={{ ...styles.button, ...styles.dangerButton }} onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <span style={{ ...styles.badge, background: '#f5f5f5', color: '#666' }}>{note.category}</span>
        {note.tags.map((tag) => (
          <span key={tag} style={styles.badge}>
            {tag}
          </span>
        ))}
      </div>

      <div
        style={{
          whiteSpace: 'pre-wrap',
          lineHeight: '1.6',
          minHeight: '200px',
          padding: '15px',
          background: '#fafafa',
          borderRadius: '6px',
        }}
      >
        {note.content || 'No content'}
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#999' }}>
        <p>Created: {new Date(note.created).toLocaleString()}</p>
        <p>Updated: {new Date(note.updated).toLocaleString()}</p>
        <p>ID: {note.id}</p>
      </div>
    </div>
  );
}

// ============ NOTE EDITOR ============

function NoteEditor({
  note,
  onSave,
  onCancel,
}: {
  note?: Note;
  onSave: (note: any) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [category, setCategory] = useState(note?.category || 'personal');
  const [tagsInput, setTagsInput] = useState(note?.tags.join(', ') || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    setIsSaving(true);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);

    if (note) {
      await onSave({ ...note, title, content, category, tags });
    } else {
      await onSave({ title, content, category, tags });
    }
    setIsSaving(false);
  };

  return (
    <div style={styles.card}>
      <h2 style={{ marginTop: 0 }}>{note ? 'Edit Note' : 'New Note'}</h2>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          style={styles.input}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your note here..."
          style={styles.textarea}
        />
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.select}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="react, typescript, ideas"
            style={styles.input}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          style={{ ...styles.button, ...styles.primaryButton }}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : note ? 'Save Changes' : 'Create Note'}
        </button>
        <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============ APP EXPORT ============

export default function FullNotesApp() {
  return (
    <WillowProvider
      config={{
        apiUrl: 'http://localhost:3031',
      }}
    >
      <NotesApp />
    </WillowProvider>
  );
}
