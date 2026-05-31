/**
 * Willow React Hooks - Full Notes Application Example
 *
 * A complete notes application demonstrating:
 * 1. Authentication flow (generate DID / log in with saved credentials)
 * 2. First-run setup (register a dataset with schema + indexes)
 * 3. Balance display
 * 4. Full CRUD on notes
 * 5. Search and category filtering
 * 6. Real-time data refresh via SWR
 * 7. Error handling patterns
 *
 * Prerequisites:
 * - npm install @willow-network/react-hooks @willow-network/sdk
 * - Run a local Willow node
 * - Have WILL tokens to fund the dataset's subgrove
 */

import React, { useState } from 'react';
import {
  WillowProvider,
  useAuth,
  useWillow,
  useRegistration,
  useCollection,
  useQuery,
  useBalance,
  useSubgroves,
} from '@willow-network/react-hooks';

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

const DATASET = 'willow-notes';
const CATEGORIES = ['personal', 'work', 'ideas', 'archive'];

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
  title: { margin: 0, fontSize: '24px', color: '#333' },
  button: {
    padding: '8px 16px',
    fontSize: '14px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryButton: { background: '#1976d2', color: '#fff' },
  secondaryButton: { background: '#e0e0e0', color: '#333' },
  dangerButton: { background: '#d32f2f', color: '#fff' },
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
  },
  sidebar: { width: '250px', flexShrink: 0 },
  main: { flex: 1, marginLeft: '20px' },
  grid: { display: 'flex' },
  statusBar: { display: 'flex', gap: '15px', fontSize: '13px', color: '#666' },
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

function NotesApp() {
  const { isAuthenticated, isLoading: authLoading } = useWillow();
  const [did, setDid] = useState<string | null>(null);

  // Determine whether the dataset is already registered so we know whether
  // to show the setup screen or jump straight into the main app.
  const { subgroves, isLoading: subgrovesLoading } = useSubgroves();
  const datasetExists = subgroves.some((sg) => sg.subgrove_id === DATASET);

  if (authLoading) return <LoadingScreen />;
  if (!isAuthenticated || !did) return <LoginScreen onLogin={setDid} />;
  if (subgrovesLoading) return <LoadingScreen />;
  if (!datasetExists) return <SetupScreen did={did} onLogout={() => setDid(null)} />;
  return <MainApp did={did} onLogout={() => setDid(null)} />;
}

function LoadingScreen() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '100px' }}>
      <h2>Loading Willow Notes...</h2>
      <p>Connecting to the network</p>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (did: string) => void }) {
  const { generateAndRegister, setIdentity, isGenerating } = useAuth();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [existingDid, setExistingDid] = useState('');
  const [existingKey, setExistingKey] = useState('');
  const [existingKeyId, setExistingKeyId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGenerateNew = async () => {
    try {
      setError(null);
      const result = await generateAndRegister();
      alert(
        `Save these securely!\n\nDID: ${result.did}\nPrivate key: ${result.privateKey}\nKey ID: ${result.didDocument.publicKeys[0].id}`,
      );
      onLogin(result.did);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleExistingLogin = () => {
    try {
      setError(null);
      setIdentity(existingDid, existingKey, existingKeyId);
      onLogin(existingDid);
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
            New user
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
            Existing user
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
              Enter your DID, private key, and key ID to resume.
            </p>
            <input
              type="text"
              placeholder="did:willow:..."
              value={existingDid}
              onChange={(e) => setExistingDid(e.target.value)}
              style={styles.input}
            />
            <input
              type="password"
              placeholder="Private key (hex)"
              value={existingKey}
              onChange={(e) => setExistingKey(e.target.value)}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="Public key ID (e.g. did:willow:.../#key-1)"
              value={existingKeyId}
              onChange={(e) => setExistingKeyId(e.target.value)}
              style={styles.input}
            />
            <button
              style={{ ...styles.button, ...styles.primaryButton, width: '100%' }}
              onClick={handleExistingLogin}
              disabled={!existingDid || !existingKey || !existingKeyId}
            >
              Resume
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SetupScreen({ did, onLogout }: { did: string; onLogout: () => void }) {
  const { registerDataset, isRegistering, error: regError } = useRegistration();
  const { clearIdentity } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async () => {
    try {
      setError(null);
      setStatus('Creating notes dataset...');
      await registerDataset({
        dataset_id: DATASET,
        name: 'Notes',
        dataset_path: ['collections'],
        schema: {
          version: 1,
          fields: {
            id: { type: 'string', indexed: true, required: true },
            title: { type: 'string', indexed: true, required: true },
            content: { type: 'string' },
            category: { type: 'string', indexed: true },
            tags: { type: 'array', indexed: true },
            created: { type: 'number', indexed: true },
            updated: { type: 'number', indexed: true },
            pinned: { type: 'boolean', indexed: true },
          },
          indexes: [
            { name: 'by_category', fields: ['category'], unique: false, type: 'hash' },
            { name: 'by_created', fields: ['created'], unique: false, type: 'range' },
            { name: 'by_updated', fields: ['updated'], unique: false, type: 'range' },
          ],
          required_fields: ['id', 'title'],
        },
        owner_did: did,
        writers: [did],
        readers: [],
      });

      setStatus('Setup complete! Refreshing...');
      window.location.reload();
    } catch (err) {
      setError(String(err));
      setStatus('');
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '100px auto' }}>
      <div style={styles.card}>
        <h2>Welcome to Willow Notes</h2>
        <p style={{ color: '#666' }}>
          First-run setup will register a notes dataset on the Willow network.
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
            {isRegistering ? 'Setting up...' : 'Set up notes storage'}
          </button>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={() => {
              clearIdentity();
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function MainApp({ did, onLogout }: { did: string; onLogout: () => void }) {
  const { clearIdentity } = useAuth();

  const { balance } = useBalance(did);

  const { store, update, remove } = useCollection(DATASET);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const queryOptions =
    categoryFilter !== 'all'
      ? { filters: { category: categoryFilter }, limit: 100 }
      : { limit: 100 };

  const {
    documents: notes,
    isLoading: notesLoading,
    refetch: refetchNotes,
  } = useQuery(DATASET, queryOptions);

  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredNotes = (notes as Note[]).filter((note) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      note.title.toLowerCase().includes(term) ||
      note.content.toLowerCase().includes(term) ||
      note.tags.some((tag) => tag.toLowerCase().includes(term))
    );
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updated - a.updated;
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

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
      showMessage('success', 'Note created');
      setIsCreating(false);
      refetchNotes();
    } catch (err) {
      showMessage('error', `Failed to create note: ${err}`);
    }
  };

  const handleUpdate = async (noteData: Note) => {
    try {
      const updatedNote = { ...noteData, updated: Date.now() };
      await update(noteData.id, updatedNote);
      showMessage('success', 'Note updated');
      setSelectedNote(updatedNote);
      setIsEditing(false);
      refetchNotes();
    } catch (err) {
      showMessage('error', `Failed to update note: ${err}`);
    }
  };

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
      <header style={styles.header}>
        <h1 style={styles.title}>Willow Notes</h1>
        <div style={styles.statusBar}>
          <span>Balance: {balance?.available ?? 0} WILL</span>
          <span>Notes: {notes.length}</span>
        </div>
        <button
          style={{ ...styles.button, ...styles.secondaryButton }}
          onClick={() => {
            clearIdentity();
            onLogout();
          }}
        >
          Logout
        </button>
      </header>

      {message && (
        <div style={message.type === 'success' ? styles.success : styles.error}>{message.text}</div>
      )}

      <div style={styles.grid}>
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
              + New note
            </button>

            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...styles.input, marginBottom: '15px' }}
            />

            <div style={{ marginBottom: '15px' }}>
              <label
                style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '5px' }}
              >
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ ...styles.select, width: '100%' }}
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
            {notesLoading ? (
              <p style={{ textAlign: 'center', color: '#666' }}>Loading notes...</p>
            ) : sortedNotes.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666' }}>
                {searchTerm ? 'No notes match your search' : 'No notes yet. Create one!'}
              </p>
            ) : (
              sortedNotes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    ...styles.noteCard,
                    borderLeft:
                      selectedNote?.id === note.id
                        ? '3px solid #1976d2'
                        : '3px solid transparent',
                  }}
                  onClick={() => {
                    setSelectedNote(note);
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                >
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '14px' }}>
                    {note.pinned && 'Pinned: '}
                    {note.title}
                  </h4>
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
                Your notes are stored on the Willow network with cryptographic proofs.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

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
      <h2 style={{ marginTop: 0 }}>{note ? 'Edit note' : 'New note'}</h2>

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
          {isSaving ? 'Saving...' : note ? 'Save changes' : 'Create note'}
        </button>
        <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function FullNotesApp() {
  return (
    <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
      <div style={styles.container}>
        <NotesApp />
      </div>
    </WillowProvider>
  );
}
