import {
  ActionIcon,
  Box,
  Group,
  Input,
  InputWrapperProps,
  LoadingOverlay,
  Paper,
  Text,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { useDidUpdate } from '@mantine/hooks';
import { MediaType } from '@prisma/client';
import { IconPhoto, IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import { isEqual } from 'lodash-es';
import { useEffect, useState } from 'react';

import { EdgeMedia } from '~/components/EdgeMedia/EdgeMedia';
import { useCFImageUpload } from '~/hooks/useCFImageUpload';
import { constants } from '~/server/common/constants';
import { IMAGE_MIME_TYPE } from '~/server/common/mime-types';
import { formatBytes } from '~/utils/number-helpers';

type SimpleImageUploadProps = Omit<InputWrapperProps, 'children' | 'onChange'> & {
  value?: string | { url: string };
  onChange?: (value: CustomFile | null) => void;
  previewWidth?: number;
  maxSize?: number;
  aspectRatio?: number;
  children?: React.ReactNode;
};

export function SimpleImageUpload({
  value,
  onChange,
  maxSize = constants.mediaUpload.maxImageFileSize,
  previewWidth = 450,
  aspectRatio,
  children,
  ...props
}: SimpleImageUploadProps) {
  const theme = useMantineTheme();
  const { uploadToCF, files: imageFiles, resetFiles } = useCFImageUpload();
  // const [files, filesHandlers] = useListState<CustomFile>(value ? [{ url: value }] : []);
  const [image, setImage] = useState<CustomFile | undefined>();
  const [error, setError] = useState('');

  const handleDrop = async (droppedFiles: FileWithPath[]) => {
    const hasLargeFile = droppedFiles.some((file) => file.size > maxSize);
    if (hasLargeFile) return setError(`Files should not exceed ${formatBytes(maxSize)}`);

    setError('');
    const [file] = droppedFiles;
    const toUpload = { url: URL.createObjectURL(file), file };
    setImage((current) => ({
      ...current,
      previewUrl: toUpload.url,
      url: '',
      file: toUpload.file,
    }));

    const { id } = await uploadToCF(toUpload.file);
    setImage((current) => ({ ...current, url: id, file: undefined, previewUrl: undefined }));
    URL.revokeObjectURL(toUpload.url);
  };

  const handleRemove = () => {
    setImage(undefined);
    onChange?.(null);
    resetFiles();
  };

  useEffect(() => {
    const newValue =
      typeof value === 'string' ? (value.length > 0 ? { url: value } : undefined) : value;

    if (!isEqual(image, newValue))
      setImage(typeof value === 'string' ? (value.length > 0 ? { url: value } : undefined) : value);
  }, [image, value]);

  useDidUpdate(() => {
    const [imageFile] = imageFiles;

    if (!imageFile) {
      return;
    }

    if (imageFile.status === 'success') {
      const { id, url, status, ...file } = imageFile;
      onChange?.({ ...image, ...file, url: id });
    }
    // don't disable the eslint-disable
  }, [imageFiles]); // eslint-disable-line

  const [match] = imageFiles;
  const showLoading = match && match.progress < 100 && !image?.url;

  return (
    <Input.Wrapper {...props} error={props.error ?? error}>
      {showLoading ? (
        <Paper
          style={{ position: 'relative', marginTop: 5, width: '100%', height: 200 }}
          withBorder
        >
          <LoadingOverlay visible />
        </Paper>
      ) : image && (image.previewUrl || image.url) ? (
        <div style={{ position: 'relative', width: '100%', marginTop: 5 }}>
          <Tooltip label="Remove image">
            <ActionIcon
              size="sm"
              variant={aspectRatio ? 'filled' : 'light'}
              color="red"
              onClick={handleRemove}
              sx={(theme) => ({
                position: 'absolute',
                top: theme.spacing.xs * 0.4,
                right: theme.spacing.xs * 0.4,
                zIndex: 1,
              })}
            >
              <IconTrash />
            </ActionIcon>
          </Tooltip>

          <Box
            sx={(theme) =>
              aspectRatio
                ? {
                    position: 'relative',
                    width: '100%',
                    overflow: 'hidden',
                    height: 0,
                    paddingBottom: `${(aspectRatio * 100).toFixed(3)}%`,
                    borderRadius: theme.radius.md,

                    '& > img': {
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      height: 'auto',
                      objectFit: 'cover',
                      borderRadius: theme.radius.md,
                    },
                  }
                : {
                    height: 'calc(100vh / 3)',
                    '& > img': {
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: theme.radius.md,
                    },
                  }
            }
          >
            <EdgeMedia
              src={image.previewUrl ?? image.url}
              type={MediaType.image}
              width={previewWidth}
              style={{ maxWidth: aspectRatio ? '100%' : undefined }}
              anim
            />
          </Box>
        </div>
      ) : (
        <Dropzone
          onDrop={handleDrop}
          accept={IMAGE_MIME_TYPE}
          maxFiles={1}
          // maxSize={maxSize}
          mt={5}
          styles={(theme) => ({
            root:
              !!props.error || !!error
                ? {
                    borderColor: theme.colors.red[6],
                    marginBottom: theme.spacing.xs / 2,
                  }
                : undefined,
          })}
        >
          <Dropzone.Accept>
            <Group position="center" spacing="xs">
              <IconUpload
                size={32}
                stroke={1.5}
                color={theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 6]}
              />
              <Text color="dimmed">Drop image here</Text>
            </Group>
          </Dropzone.Accept>
          <Dropzone.Reject>
            <Group position="center" spacing="xs">
              <IconX
                size={32}
                stroke={1.5}
                color={theme.colors.red[theme.colorScheme === 'dark' ? 4 : 6]}
              />
              <Text>File not accepted</Text>
            </Group>
          </Dropzone.Reject>
          <Dropzone.Idle>
            <Group position="center" spacing="xs">
              <IconPhoto size={32} stroke={1.5} />
              <Text color="dimmed">{`Drop image here, should not exceed ${formatBytes(
                maxSize
              )}`}</Text>
            </Group>
          </Dropzone.Idle>
        </Dropzone>
      )}
      {children}
    </Input.Wrapper>
  );
}
