import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  HoverCard,
  Stack,
  Text,
  ThemeIcon,
  MantineColor,
  Tooltip,
  TooltipProps,
  createStyles,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { openConfirmModal } from '@mantine/modals';
import { NextLink } from '@mantine/next';
import { IconBolt, IconPhoto, IconPlayerPlayFilled, IconTrash, IconX } from '@tabler/icons-react';

import { Collection } from '~/components/Collection/Collection';
import { ContentClamp } from '~/components/ContentClamp/ContentClamp';
import { openBoostModal } from '~/components/ImageGeneration/BoostModal';
import { GeneratedImage } from '~/components/ImageGeneration/GeneratedImage';
import { GenerationDetails } from '~/components/ImageGeneration/GenerationDetails';
import { useDeleteGenerationRequest } from '~/components/ImageGeneration/utils/generationRequestHooks';
import { constants } from '~/server/common/constants';
import { Generation, GenerationRequestStatus } from '~/server/services/generation/generation.types';
import { generationPanel, generationStore } from '~/store/generation.store';
import { formatDateMin } from '~/utils/date-helpers';
import { FeedItem } from './FeedItem';

const tooltipProps: Omit<TooltipProps, 'children' | 'label'> = {
  withinPortal: true,
  withArrow: true,
  color: 'dark',
  zIndex: constants.imageGeneration.drawerZIndex + 1,
};

const statusColors: Record<GenerationRequestStatus, MantineColor> = {
  [GenerationRequestStatus.Pending]: 'gray',
  [GenerationRequestStatus.Cancelled]: 'gray',
  [GenerationRequestStatus.Processing]: 'yellow',
  [GenerationRequestStatus.Succeeded]: 'green',
  [GenerationRequestStatus.Error]: 'red',
};

// export function QueueItem({ data: request, index }: { data: Generation.Request; index: number }) {
export function QueueItem({ request }: Props) {
  const [showBoost] = useLocalStorage({ key: 'show-boost-modal', defaultValue: false });
  const { classes } = useStyle();
  const status = request.status ?? GenerationRequestStatus.Pending;
  const pendingProcessing =
    status === GenerationRequestStatus.Pending || status === GenerationRequestStatus.Processing;
  const failed = status === GenerationRequestStatus.Error;

  const verbage = pendingProcessing
    ? {
        modal: {
          title: 'Cancel Request',
          children: `Are you sure you want to cancel this request?`,
          labels: { confirm: 'Delete', cancel: "No, don't cancel it" },
        },
        tooltip: 'Cancel',
      }
    : {
        modal: {
          title: 'Delete Creation',
          children: `Are you sure you want to delete this creation?`,
          labels: { confirm: 'Delete', cancel: "No, don't delete it" },
        },
        tooltip: 'Delete',
      };

  const deleteMutation = useDeleteGenerationRequest();
  const handleDeleteQueueItem = () => {
    openConfirmModal({
      ...verbage.modal,
      confirmProps: { color: 'red' },
      zIndex: constants.imageGeneration.drawerZIndex + 1,
      onConfirm: () => {
        deleteMutation.mutate({ id: request.id });
      },
    });
  };

  const handleGenerate = () => {
    const { resources, params } = request;
    generationStore.setData({
      type: 'remix',
      data: { resources, params: { ...params, seed: undefined } },
    });
  };

  const { prompt, ...details } = request.params;

  // const boost = (request: Generation.Request) => {
  //   console.log('boost it', request);
  // };

  // TODO - enable this after boosting is ready
  // const handleBoostClick = () => {
  //   if (showBoost) openBoostModal({ request, cb: boost });
  //   else boost(request);
  // };

  return (
    <Card withBorder px="xs">
      <Card.Section py={4} inheritPadding withBorder>
        <Group position="apart">
          <Group spacing={8}>
            {!!request.images?.length && (
              <Tooltip label={status} withArrow color="dark">
                <ThemeIcon
                  variant={pendingProcessing ? 'filled' : 'light'}
                  w="auto"
                  h="auto"
                  size="sm"
                  color={statusColors[status]}
                  px={4}
                  py={2}
                  sx={{ cursor: 'default' }}
                >
                  <Group spacing={4}>
                    <IconPhoto size={16} />
                    <Text size="sm" inline weight={500}>
                      {request.images.length}
                    </Text>
                  </Group>
                </ThemeIcon>
              </Tooltip>
            )}
            {pendingProcessing && request.queuePosition && (
              <Button.Group>
                {request.queuePosition && (
                  <Button
                    size="xs"
                    variant="outline"
                    color="gray"
                    sx={{ pointerEvents: 'none' }}
                    compact
                  >
                    {request.queuePosition.precedingJobs}/{request.queuePosition.jobs}
                  </Button>
                )}
                <HoverCard withArrow position="top" withinPortal zIndex={400}>
                  <HoverCard.Target>
                    <Button
                      size="xs"
                      rightIcon={showBoost ? <IconBolt size={16} /> : undefined}
                      compact
                      // onClick={handleBoostClick}
                    >
                      Boost
                    </Button>
                  </HoverCard.Target>
                  <HoverCard.Dropdown title="Coming soon" maw={300}>
                    <Stack spacing={0}>
                      <Text weight={500}>Coming soon!</Text>
                      <Text size="xs">
                        Want to run this request faster? Boost it to the front of the queue.
                      </Text>
                    </Stack>
                  </HoverCard.Dropdown>
                </HoverCard>
              </Button.Group>
            )}
            <Text size="xs" color="dimmed">
              {formatDateMin(request.createdAt)}
            </Text>
          </Group>
          <Group spacing="xs">
            <Tooltip {...tooltipProps} label="Generate">
              <ActionIcon size="md" p={4} variant="light" radius={0} onClick={handleGenerate}>
                <IconPlayerPlayFilled />
              </ActionIcon>
            </Tooltip>
            <Tooltip {...tooltipProps} label={verbage.tooltip}>
              <ActionIcon
                size="md"
                onClick={handleDeleteQueueItem}
                disabled={deleteMutation.isLoading}
              >
                {pendingProcessing ? <IconX size={20} /> : <IconTrash size={20} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Card.Section>
      <Stack py="xs" spacing={8} className={classes.container}>
        <ContentClamp maxHeight={36} labelSize="xs">
          <Text lh={1.3} sx={{ wordBreak: 'break-all' }}>
            {prompt}
          </Text>
        </ContentClamp>
        <Collection
          items={request.resources}
          limit={3}
          renderItem={(resource: Generation.Resource) => (
            <Badge
              size="sm"
              sx={{ maxWidth: 200, cursor: 'pointer' }}
              component={NextLink}
              href={`/models/${resource.modelId}?modelVersionId=${resource.id}`}
              onClick={() => generationPanel.close()}
            >
              {resource.modelName} - {resource.name}
            </Badge>
          )}
          grouped
        />
        {!failed && !!request.images?.length && (
          <div className={classes.grid}>
            {request.images.map((image) => (
              <GeneratedImage key={image.id} image={image} request={request} />
            ))}
          </div>
        )}
      </Stack>
      <Card.Section
        withBorder
        sx={(theme) => ({
          marginLeft: -theme.spacing.xs,
          marginRight: -theme.spacing.xs,
        })}
      >
        <GenerationDetails
          label="Additional Details"
          params={details}
          labelWidth={150}
          paperProps={{ radius: 0, sx: { borderWidth: '1px 0 0 0' } }}
        />
      </Card.Section>
      {/* <Card.Section py="xs" inheritPadding>
        <Group position="apart" spacing={8}>
          <Text color="dimmed" size="xs">
            Fulfillment by {item.provider.name}
          </Text>
          <Text color="dimmed" size="xs">
            Started <DaysFromNow date={item.createdAt} />
          </Text>
        </Group>
      </Card.Section> */}
    </Card>
  );
}

type Props = {
  request: Generation.Request;
  // id: number;
};

const useStyle = createStyles((theme) => ({
  grid: {
    display: 'grid',
    gap: theme.spacing.xs,
    gridTemplateColumns: 'repeat(2, 1fr)', // default for larger screens, max 6 columns

    // [`@media (max-width: ${theme.breakpoints.xl}px)`]: {
    //   gridTemplateColumns: 'repeat(4, 1fr)', // 4 columns for screens smaller than xl
    // },
    [`@container (min-width: 530px)`]: {
      gridTemplateColumns: 'repeat(3, 1fr)', // 3 columns for screens smaller than md
    },
    [`@container (min-width: 900px)`]: {
      gridTemplateColumns: 'repeat(4, 1fr)', // 5 columns for screens smaller than xl
    },
    [`@container (min-width: 1200px)`]: {
      gridTemplateColumns: 'repeat(auto-fill, minmax(256px, 1fr))',
    },
  },
  asSidebar: {
    gridTemplateColumns: 'repeat(2, 1fr)',
  },
  container: {
    containerType: 'inline-size',
  },
}));
