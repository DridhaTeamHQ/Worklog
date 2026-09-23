import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Linking,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  AttachedFile,
  pickPhotoFromGallery,
  takePhotoWithCamera,
  pickDocumentFile,
} from '../utils/fileUpload';
import { colors, borderRadius } from '../theme';

interface AttachmentPickerProps {
  attachments: AttachedFile[];
  onChange: (attachments: AttachedFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function AttachmentPicker({
  attachments,
  onChange,
  maxFiles = 5,
  disabled = false,
}: AttachmentPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const handlePick = async (pickerFn: () => Promise<AttachedFile | null>) => {
    setModalVisible(false);
    setErrorMsg('');
    setUploading(true);
    try {
      const file = await pickerFn();
      if (file) {
        onChange([...attachments, file]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not attach file.');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    onChange(attachments.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Attachments</Text>
        {attachments.length > 0 && (
          <Text style={styles.countText}>
            {attachments.length}/{maxFiles}
          </Text>
        )}
      </View>

      {/* Attached Items List */}
      {attachments.length > 0 && (
        <View style={styles.list}>
          {attachments.map((file, idx) => (
            <View key={idx} style={styles.attachmentItem}>
              {file.type === 'image' ? (
                <TouchableOpacity
                  onPress={() => setPreviewPhoto(file.url)}
                  activeOpacity={0.8}
                  style={styles.thumbWrapper}
                >
                  <Image source={{ uri: file.url }} style={styles.thumb} resizeMode="cover" />
                  <View style={styles.zoomBadge}>
                    <Ionicons name="expand" size={10} color="#fff" />
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.fileIconWrapper}>
                  <Ionicons name="document-text" size={22} color={colors.primary} />
                </View>
              )}

              <View style={styles.fileInfo}>
                <Text numberOfLines={1} style={styles.fileName}>
                  {file.name}
                </Text>
                <Text style={styles.fileSub}>
                  {file.type === 'image' ? 'Photo' : 'Document'}
                  {file.size ? ` · ${file.size}` : ''}
                </Text>
              </View>

              {!disabled && (
                <TouchableOpacity
                  onPress={() => removeAttachment(idx)}
                  style={styles.removeBtn}
                  accessibilityLabel="Remove attachment"
                >
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Add Button */}
      {attachments.length < maxFiles && !disabled && (
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          disabled={uploading}
          style={[styles.addButton, uploading && styles.addButtonDisabled]}
          activeOpacity={0.7}
        >
          {uploading ? (
            <>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.addButtonText}>Uploading file...</Text>
            </>
          ) : (
            <>
              <Ionicons name="attach" size={18} color={colors.primary} />
              <Text style={styles.addButtonText}>Attach Photo / Document</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {Boolean(errorMsg) && <Text style={styles.errorText}>{errorMsg}</Text>}

      {/* Choice Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Attach File</Text>

            <TouchableOpacity
              style={styles.actionOption}
              onPress={() => void handlePick(takePhotoWithCamera)}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(244, 85, 60, 0.15)' }]}>
                <Ionicons name="camera" size={20} color={colors.primary} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionOptionTitle}>Take Photo</Text>
                <Text style={styles.actionOptionSub}>Capture with device camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionOption}
              onPress={() => void handlePick(pickPhotoFromGallery)}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Ionicons name="images" size={20} color="#c084fc" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.actionOptionSub}>Select an image or screenshot</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionOption}
              onPress={() => void handlePick(pickDocumentFile)}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="folder-open" size={20} color="#3b82f6" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionOptionTitle}>Choose Document / File</Text>
                <Text style={styles.actionOptionSub}>PDF, Word, Excel, ZIP, etc.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen Photo Preview Modal */}
      <Modal
        visible={Boolean(previewPhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <SafeAreaView style={styles.fullscreenOverlay}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity
              onPress={() => setPreviewPhoto(null)}
              style={styles.fullscreenCloseBtn}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.fullscreenTitle}>Photo Preview</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.fullscreenBody}>
            {Boolean(previewPhoto) && (
              <Image
                source={{ uri: previewPhoto! }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/**
 * Read-only view for displaying attachments in Ticket or Task details
 */
export function AttachmentList({ attachments }: { attachments: AttachedFile[] }) {
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const handleOpen = (file: AttachedFile) => {
    if (file.type === 'image') {
      setPreviewPhoto(file.url);
    } else {
      Linking.openURL(file.url).catch(() => {});
    }
  };

  return (
    <View style={styles.viewContainer}>
      <Text style={styles.label}>Attached Files ({attachments.length})</Text>
      <View style={styles.list}>
        {attachments.map((file, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.viewItem}
            activeOpacity={0.7}
            onPress={() => handleOpen(file)}
          >
            {file.type === 'image' ? (
              <Image source={{ uri: file.url }} style={styles.viewThumb} resizeMode="cover" />
            ) : (
              <View style={styles.fileIconWrapper}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
              </View>
            )}

            <View style={styles.fileInfo}>
              <Text numberOfLines={1} style={styles.fileName}>
                {file.name}
              </Text>
              <Text style={styles.fileSub}>
                {file.type === 'image' ? 'Photo · Tap to view' : file.size ? `${file.size} · Tap to open` : 'Tap to open'}
              </Text>
            </View>

            <Ionicons
              name={file.type === 'image' ? 'expand-outline' : 'open-outline'}
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Fullscreen Photo Modal */}
      <Modal
        visible={Boolean(previewPhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <SafeAreaView style={styles.fullscreenOverlay}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity
              onPress={() => setPreviewPhoto(null)}
              style={styles.fullscreenCloseBtn}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.fullscreenTitle}>Attachment Preview</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.fullscreenBody}>
            {Boolean(previewPhoto) && (
              <Image
                source={{ uri: previewPhoto! }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  viewContainer: {
    marginTop: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  countText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  list: {
    gap: 8,
    marginBottom: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f23',
    borderWidth: 1,
    borderColor: '#2e2e33',
    borderRadius: borderRadius.md,
    padding: 8,
    gap: 10,
  },
  viewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: borderRadius.md,
    padding: 8,
    gap: 10,
  },
  thumbWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  viewThumb: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.sm,
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 3,
    padding: 2,
  },
  fileIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(244, 85, 60, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  fileSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  removeBtn: {
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(244, 85, 60, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 85, 60, 0.3)',
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontSize: 11,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#2e2e33',
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3f3f46',
    alignSelf: 'center',
    marginBottom: 6,
  },
  actionSheetTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1f1f23',
    borderRadius: borderRadius.md,
    gap: 12,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionOptionTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '600',
  },
  actionOptionSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#27272a',
    borderRadius: borderRadius.md,
    marginTop: 4,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000000fa',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  fullscreenCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  fullscreenBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
});
