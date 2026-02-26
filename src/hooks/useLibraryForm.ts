import { useState, useMemo, useCallback, useRef, ChangeEvent } from 'react';
import { useSessionContext } from '@/contexts/SessionContext';
import { useCloudSyncContext } from '@/contexts/CloudSyncContext';
import type { MediaItem, MediaType, MediaStatus, MediaMetadata } from '@/types';
import { generateId } from '@/utils/formatters';
import { MEDIA_TYPES, getMetadataFields } from '@/utils/mediaHelpers';

export function useLibraryForm() {
  const { state: { mediaItems }, actions: { addMediaItem, updateMediaItem, deleteMediaItem } } = useSessionContext();
  const cloudSync = useCloudSyncContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edit/create form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<MediaType>('Movie');
  const [formNotionUrl, setFormNotionUrl] = useState('');
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [formRating, setFormRating] = useState(0);
  const [formStatus, setFormStatus] = useState<MediaStatus | ''>('');
  const [formDateFinished, setFormDateFinished] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formMetadata, setFormMetadata] = useState<MediaMetadata>({});
  const [isUploading, setIsUploading] = useState(false);

  // Filter by search
  const filtered = useMemo(() =>
    mediaItems.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    ), [mediaItems, searchQuery]);

  // Group by type
  const grouped = useMemo(() => {
    const groups: Record<string, MediaItem[]> = {};
    for (const type of MEDIA_TYPES) {
      const items = filtered.filter(m => m.mediaType === type);
      if (items.length > 0) {
        groups[type] = items.sort((a, b) => b.createdAt - a.createdAt);
      }
    }
    return groups;
  }, [filtered]);

  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormType('Movie');
    setFormNotionUrl('');
    setFormCoverUrl('');
    setFormRating(0);
    setFormStatus('');
    setFormDateFinished('');
    setFormNotes('');
    setFormMetadata({});
  }, []);

  const startEdit = useCallback((item: MediaItem) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormType(item.mediaType);
    setFormNotionUrl(item.notionUrl || '');
    setFormCoverUrl(item.coverUrl || '');
    setFormRating(item.rating || 0);
    setFormStatus(item.status || '');
    setFormDateFinished(item.dateFinished || '');
    setFormNotes(item.notes || '');
    setFormMetadata(item.metadata || {});
    setIsCreating(false);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    resetForm();
  }, [resetForm]);

  const buildMediaItem = useCallback((): Partial<Omit<MediaItem, 'id' | 'createdAt'>> => {
    const typeFields = getMetadataFields(formType);
    const cleanMeta: MediaMetadata = {};
    for (const field of typeFields) {
      const val = formMetadata[field.key];
      if (val !== undefined && val !== '' && val !== 0) {
        (cleanMeta as Record<string, unknown>)[field.key] = val;
      }
    }

    return {
      title: formTitle.trim(),
      mediaType: formType,
      notionUrl: formNotionUrl.trim() || undefined,
      coverUrl: formCoverUrl.trim() || undefined,
      rating: formRating || undefined,
      status: (formStatus as MediaStatus) || undefined,
      dateFinished: formDateFinished || undefined,
      notes: formNotes.trim() || undefined,
      metadata: Object.keys(cleanMeta).length > 0 ? cleanMeta : undefined,
    };
  }, [formTitle, formType, formNotionUrl, formCoverUrl, formRating, formStatus, formDateFinished, formNotes, formMetadata]);

  const saveEdit = useCallback(() => {
    if (!editingId || !formTitle.trim()) return;
    updateMediaItem(editingId, buildMediaItem());
    cancelEdit();
  }, [editingId, formTitle, buildMediaItem, updateMediaItem, cancelEdit]);

  const startCreate = useCallback(() => {
    setIsCreating(true);
    setEditingId(null);
    resetForm();
  }, [resetForm]);

  const handleCreate = useCallback(() => {
    if (!formTitle.trim()) return;
    const item = buildMediaItem();
    addMediaItem({
      id: generateId(),
      title: item.title!,
      mediaType: item.mediaType!,
      notionUrl: item.notionUrl,
      coverUrl: item.coverUrl,
      rating: item.rating,
      status: item.status,
      dateFinished: item.dateFinished,
      notes: item.notes,
      metadata: item.metadata,
      createdAt: Date.now(),
    });
    setIsCreating(false);
    resetForm();
  }, [formTitle, buildMediaItem, addMediaItem, resetForm]);

  const handleDelete = useCallback((id: string) => {
    deleteMediaItem(id);
    setDeleteConfirmId(null);
  }, [deleteMediaItem]);

  const updateMetaField = useCallback((key: keyof MediaMetadata, value: string | number) => {
    setFormMetadata(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleFormTypeChange = useCallback((type: MediaType) => {
    setFormType(type);
    setFormMetadata({});
  }, []);

  // Unified file upload handler — shared by CoverUpload in both form and detail edit
  const handleFileUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!cloudSync.isLoggedIn) {
      alert('Please connect to cloud sync first to upload images.');
      return;
    }
    try {
      setIsUploading(true);
      const url = await cloudSync.uploadImage(file);
      setFormCoverUrl(url);
    } catch (err) {
      alert(`Upload failed: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [cloudSync]);

  return {
    // Data
    mediaItems,
    filtered,
    grouped,

    // UI state
    searchQuery, setSearchQuery,
    editingId,
    deleteConfirmId, setDeleteConfirmId,
    isCreating, setIsCreating,
    expandedId, setExpandedId,

    // Form state
    formTitle, setFormTitle,
    formType, handleFormTypeChange,
    formNotionUrl, setFormNotionUrl,
    formCoverUrl, setFormCoverUrl,
    formRating, setFormRating,
    formStatus, setFormStatus,
    formDateFinished, setFormDateFinished,
    formNotes, setFormNotes,
    formMetadata,
    updateMetaField,
    isUploading,
    fileInputRef,
    cloudSync,

    // Actions
    startEdit,
    cancelEdit,
    saveEdit,
    startCreate,
    handleCreate,
    handleDelete,
    handleFileUpload,
  };
}

export type UseLibraryFormReturn = ReturnType<typeof useLibraryForm>;
