import type { TooltipProps } from '@mantine/core';
import {
  ActionIcon,
  AspectRatio,
  Box,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  IconBan,
  IconCheck,
  IconExternalLink,
  IconInfoCircle,
  IconReload,
  IconSquareCheck,
  IconSquareOff,
} from '@tabler/icons-react';
import produce from 'immer';
import { NextLink as Link } from '~/components/NextLink/NextLink';
import { useEffect, useMemo } from 'react';
import { ButtonTooltip } from '~/components/CivitaiWrapped/ButtonTooltip';
import { EdgeMedia } from '~/components/EdgeMedia/EdgeMedia';
import { MediaHash } from '~/components/ImageHash/ImageHash';
import { ImageMetaPopover } from '~/components/ImageMeta/ImageMeta';
import { InViewLoader } from '~/components/InView/InViewLoader';
import { MasonryColumns } from '~/components/MasonryColumns/MasonryColumns';
import { NoContent } from '~/components/NoContent/NoContent';
import { PopConfirm } from '~/components/PopConfirm/PopConfirm';
import { VotableTags } from '~/components/VotableTags/VotableTags';
import type { ImageMetaProps } from '~/server/schema/image.schema';
import type { ImageModerationReviewQueueImage } from '~/types/router';
import { trpc } from '~/utils/trpc';
import { getImageEntityUrl } from '~/utils/moderators/moderator.util';
import { createSelectStore } from '~/store/select.store';
import { ImageGuard2 } from '~/components/ImageGuard/ImageGuard2';
import { MasonryContainer } from '~/components/MasonryColumns/MasonryContainer';
import { MasonryProvider } from '~/components/MasonryColumns/MasonryProvider';
import { LegacyActionIcon } from '~/components/LegacyActionIcon/LegacyActionIcon';

const imageSelectStore = createSelectStore<number>();

export default function ImageTags() {
  const filters = { tagReview: true };
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, isRefetching } =
    trpc.image.getModeratorReviewQueue.useInfiniteQuery(filters, {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });
  const images = useMemo(() => data?.pages.flatMap((x) => x.items) ?? [], [data?.pages]);

  useEffect(() => {
    return () => imageSelectStore.setSelected([]);
  }, []);

  return (
    <MasonryProvider>
      <MasonryContainer>
        <Stack>
          <Paper
            withBorder
            shadow="lg"
            p="xs"
            style={{
              display: 'inline-flex',
              float: 'right',
              alignSelf: 'flex-end',
              marginRight: 6,
              position: 'sticky',
              top: 'var(--header-height,0)',
              marginBottom: -80,
              zIndex: 10,
            }}
          >
            <ModerationControls images={images} filters={filters} />
          </Paper>

          <Stack gap={0} mb="lg">
            <Title order={1}>Tags Needing Review</Title>
            <Text c="dimmed">
              These are images with moderation tags that users have voted to remove.
            </Text>
          </Stack>

          {isLoading ? (
            <Center py="xl">
              <Loader size="xl" />
            </Center>
          ) : images.length ? (
            // <MasonryGrid
            //   items={images}
            //   isRefetching={isRefetching}
            //   isFetchingNextPage={isFetchingNextPage}
            //   render={ImageGridItem}
            // />
            <MasonryColumns
              data={images}
              imageDimensions={(data) => {
                const width = data?.width ?? 450;
                const height = data?.height ?? 450;
                return { width, height };
              }}
              maxItemHeight={600}
              render={ImageGridItem}
              itemId={(data) => data.id}
            />
          ) : (
            <NoContent mt="lg" message="There are no tags that need review" />
          )}
          {hasNextPage && (
            <InViewLoader
              loadFn={fetchNextPage}
              loadCondition={!isRefetching}
              style={{ gridColumn: '1/-1' }}
            >
              <Center p="xl" style={{ height: 36 }} mt="md">
                <Loader />
              </Center>
            </InViewLoader>
          )}
        </Stack>
      </MasonryContainer>
    </MasonryProvider>
  );
}

function ModerationControls<T extends { id: number }>({
  images,
  filters,
}: {
  images: T[];
  filters?: Record<string, unknown>;
}) {
  const selected = imageSelectStore.useSelection();

  const queryUtils = trpc.useUtils();
  const moderateTagsMutation = trpc.tag.moderateTags.useMutation({
    async onMutate({ entityIds, disable }) {
      await queryUtils.image.getModeratorReviewQueue.cancel();
      queryUtils.image.getModeratorReviewQueue.setInfiniteData(
        { tagReview: true },
        produce((data) => {
          if (!data?.pages?.length) return;

          // Remove tag from selected images
          for (const page of data.pages) {
            for (const item of page.items) {
              if (item.tags && entityIds.includes(item.id)) {
                if (disable) item.tags = item.tags.filter((tag) => !tag.needsReview);
                else for (const tag of item.tags) tag.needsReview = false;
              }
            }
          }
        })
      );
    },
  });

  const handleSelectAll = () => {
    const selected = imageSelectStore.getSelected();
    if (selected.length === images.length) imageSelectStore.setSelected([]);
    else imageSelectStore.setSelected(images.map((x) => x.id));
  };

  const handleClearAll = () => {
    imageSelectStore.setSelected([]);
  };

  const handleSelected = (disable: boolean) => {
    moderateTagsMutation.mutate(
      {
        entityIds: selected,
        entityType: 'image',
        disable,
      },
      {
        onSuccess: handleClearAll,
      }
    );
  };

  const handleRefresh = () => {
    handleClearAll();
    queryUtils.image.getModeratorReviewQueue.invalidate(filters);
    showNotification({
      id: 'refreshing',
      title: 'Refreshing',
      message: 'Grabbing the latest data...',
      color: 'blue',
    });
  };

  const tooltipProps: Omit<TooltipProps, 'label' | 'children'> = {
    position: 'bottom',
    withArrow: true,
    withinPortal: true,
  };

  return (
    <Group wrap="nowrap" gap="xs">
      <ButtonTooltip label="Select all" {...tooltipProps}>
        <LegacyActionIcon variant="outline" onClick={handleSelectAll}>
          <IconSquareCheck size="1.25rem" />
        </LegacyActionIcon>
      </ButtonTooltip>
      <ButtonTooltip label="Clear selection" {...tooltipProps}>
        <LegacyActionIcon variant="outline" disabled={!selected.length} onClick={handleClearAll}>
          <IconSquareOff size="1.25rem" />
        </LegacyActionIcon>
      </ButtonTooltip>
      <PopConfirm
        message={`Are you sure you want to approve ${selected.length} tag removal(s)?`}
        position="bottom-end"
        onConfirm={() => handleSelected(true)}
        withArrow
      >
        <ButtonTooltip label="Approve selected" {...tooltipProps}>
          <LegacyActionIcon variant="outline" disabled={!selected.length} color="green">
            <IconCheck size="1.25rem" />
          </LegacyActionIcon>
        </ButtonTooltip>
      </PopConfirm>
      <PopConfirm
        message={`Are you sure you want to decline ${selected.length} tag removal(s)?`}
        position="bottom-end"
        onConfirm={() => handleSelected(false)}
        withArrow
      >
        <ButtonTooltip label="Decline selected" {...tooltipProps}>
          <LegacyActionIcon variant="outline" disabled={!selected.length} color="red">
            <IconBan size="1.25rem" />
          </LegacyActionIcon>
        </ButtonTooltip>
      </PopConfirm>
      <ButtonTooltip label="Refresh" {...tooltipProps}>
        <LegacyActionIcon variant="outline" onClick={handleRefresh} color="blue">
          <IconReload size="1.25rem" />
        </LegacyActionIcon>
      </ButtonTooltip>
    </Group>
  );
}

function ImageGridItem({ data: image, width: itemWidth }: ImageGridItemProps) {
  const height = useMemo(() => {
    if (!image.width || !image.height) return 300;
    const width = itemWidth > 0 ? itemWidth : 300;
    const aspectRatio = image.width / image.height;
    const imageHeight = Math.floor(width / aspectRatio);
    return Math.min(imageHeight, 600);
  }, [itemWidth, image.width, image.height]);

  const tags = useMemo(
    () => ({
      toReview: image.tags?.filter((x) => x.needsReview) ?? [],
      moderation: image.tags?.filter((x) => x.type === 'Moderation') ?? [],
    }),
    [image.tags]
  );
  const needsReview = tags.toReview.length > 0;
  const entityUrl = getImageEntityUrl(image);

  const selected = imageSelectStore.useIsSelected(image.id);

  return (
    <Card shadow="sm" p="xs" style={{ opacity: !needsReview ? 0.2 : undefined }} withBorder>
      <Card.Section
        style={{ height: `${height}px`, cursor: 'pointer' }}
        onClick={() => imageSelectStore.toggle(image.id)}
      >
        <Checkbox
          checked={selected}
          readOnly
          size="lg"
          className="absolute right-[5px] top-[5px] z-10"
        />
        <ImageGuard2 image={image}>
          {(safe) => (
            <Box style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
              <ImageGuard2.BlurToggle className="absolute left-2 top-2 z-10" />
              {!safe ? (
                <AspectRatio ratio={(image.width ?? 1) / (image.height ?? 1)}>
                  <MediaHash {...image} />
                </AspectRatio>
              ) : (
                <>
                  <EdgeMedia
                    src={image.url}
                    name={image.name ?? image.id.toString()}
                    alt={image.name ?? undefined}
                    type={image.type}
                    width={450}
                    placeholder="empty"
                  />
                  {entityUrl && (
                    <Link legacyBehavior href={entityUrl} passHref>
                      <LegacyActionIcon
                        component="a"
                        variant="transparent"
                        className="absolute bottom-[5px] left-[5px]"
                        size="lg"
                        target="_blank"
                        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                          e.stopPropagation();
                        }}
                      >
                        <IconExternalLink
                          color="white"
                          filter="drop-shadow(1px 1px 2px rgb(0 0 0 / 50%)) drop-shadow(0px 5px 15px rgb(0 0 0 / 60%))"
                          opacity={0.8}
                          strokeWidth={2.5}
                          size={26}
                        />
                      </LegacyActionIcon>
                    </Link>
                  )}
                  {image.meta && (
                    <ImageMetaPopover meta={image.meta as ImageMetaProps}>
                      <LegacyActionIcon
                        variant="transparent"
                        style={{ position: 'absolute', bottom: '5px', right: '5px' }}
                        size="lg"
                      >
                        <IconInfoCircle
                          color="white"
                          filter="drop-shadow(1px 1px 2px rgb(0 0 0 / 50%)) drop-shadow(0px 5px 15px rgb(0 0 0 / 60%))"
                          opacity={0.8}
                          strokeWidth={2.5}
                          size={26}
                        />
                      </LegacyActionIcon>
                    </ImageMetaPopover>
                  )}
                </>
              )}
            </Box>
          )}
        </ImageGuard2>
      </Card.Section>
      {needsReview && (
        <VotableTags
          mt="xs"
          tags={tags.moderation}
          entityType="image"
          entityId={image.id}
          highlightContested
        />
      )}
    </Card>
  );
}

type ImageGridItemProps = {
  data: ImageModerationReviewQueueImage;
  index: number;
  width: number;
};
