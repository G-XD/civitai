import type { BadgeProps, TooltipProps } from '@mantine/core';
import {
  Badge,
  Button,
  Center,
  Group,
  Popover,
  Stack,
  Table,
  Tooltip,
  Text,
  Alert,
  Divider,
  Loader,
  ScrollArea,
  SimpleGrid,
  Card,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconRefresh,
  IconPhoto,
  IconArrowBigRight,
  IconBan,
} from '@tabler/icons-react';
import { EdgeMedia } from '~/components/EdgeMedia/EdgeMedia';
import { QS } from '~/utils/qs';
import { trpc } from '~/utils/trpc';
import classes from './RunPartners.module.scss';

export function RunPartners({ modelVersionId }: { modelVersionId: number }) {
  const colorScheme = useComputedColorScheme('dark');
  const { data: strategies = [], isLoading: strategiesLoading } =
    trpc.modelVersion.getRunStrategies.useQuery({ id: modelVersionId });
  const { data: partners, isLoading: partnersLoading } = trpc.partner.getAll.useQuery();

  // add strategies to partners
  const partnersWithStrategies =
    partners
      ?.map((partner) => ({
        ...partner,
        strategies: strategies.filter((strategy) => strategy.partnerId === partner.id),
      }))
      .map((partner) => ({
        ...partner,
        available: partner.strategies.length > 0,
      })) ?? [];

  const defaultBadgeProps: BadgeProps = {
    variant: 'outline',
    radius: 'sm',
    color: colorScheme === 'dark' ? 'gray' : 'dark',
    styles: {
      root: { textTransform: 'none', userSelect: 'none' },
    },
  };

  const defaultTooltipProps: Omit<TooltipProps, 'children' | 'label'> = {
    withArrow: true,
    openDelay: 500,
  };

  const premiumPartners = partnersWithStrategies.filter((x) => x.available && x.tier > 0);
  const availablePartners = partnersWithStrategies.filter((x) => x.available && x.tier <= 0);
  const unavailablePartners = partnersWithStrategies.filter((x) => !x.available);

  const renderPremiumPartners = (partners: typeof partnersWithStrategies) => {
    return (
      <SimpleGrid cols={3}>
        {partners.map((partner) => (
          <Card key={partner.id} withBorder className={classes.premiumPartner}>
            <Card.Section>
              {partner.logo && <EdgeMedia src={partner.logo} alt={partner.name} />}
            </Card.Section>
            <Card.Section inheritPadding py="xs">
              <Text>{partner.name}</Text>
            </Card.Section>
            <Card.Section inheritPadding pb="xs">
              <Group gap={4}>
                {partner.startupTime && (
                  <Badge {...defaultBadgeProps} leftSection={<IconRefresh size={14} />}>
                    {abbreviateTime(partner.startupTime)}
                  </Badge>
                )}
                <Badge {...defaultBadgeProps} leftSection={<IconPhoto size={14} />}>
                  {abbreviateTime(calculateStepsPerSecond(partner.stepsPerSecond))}
                </Badge>
                <Badge {...defaultBadgeProps}>{partner.price}</Badge>
              </Group>
            </Card.Section>
            <Button
              color="blue"
              size="xs"
              px="md"
              component="a"
              href={`/api/run/${modelVersionId}?${QS.stringify({
                partnerId: partner.id,
              })}`}
              target="_blank"
              rel="nofollow noreferrer"
              fullWidth
            >
              <Text></Text>
              <IconArrowBigRight size={20} />
            </Button>
          </Card>
        ))}
      </SimpleGrid>
    );
  };

  const renderPartners = (
    partners: typeof partnersWithStrategies,
    extra: React.ReactNode = null
  ) => {
    return (
      <Table striped verticalSpacing={0} horizontalSpacing={0}>
        <Table.Tbody>
          {partners.map(
            (
              {
                id,
                name,
                about,
                startupTime,
                stepsPerSecond,
                price,
                strategies,
                available: enabled,
                homepage,
                tos,
                privacy,
              },
              index
            ) => (
              <Table.Tr key={index} style={{ opacity: !enabled ? 1 : undefined }}>
                <Table.Td>
                  <Group justify="space-between" p="sm">
                    <Group gap="xs">
                      <Text>{name}</Text>
                      <Popover width={400} withinPortal withArrow>
                        <Popover.Target>
                          <Center className="cursor-pointer">
                            <IconInfoCircle size={20} />
                          </Center>
                        </Popover.Target>
                        <Popover.Dropdown>
                          <Stack>
                            <Text>{about}</Text>
                            <Group gap="xs">
                              {homepage && (
                                <Button
                                  size="compact-sm"
                                  variant="light"
                                  component="a"
                                  href={homepage}
                                  target="_blank"
                                  rel="nofollow noreferrer"
                                >
                                  Website
                                </Button>
                              )}
                              {tos && (
                                <Button
                                  size="compact-sm"
                                  variant="light"
                                  component="a"
                                  href={tos}
                                  target="_blank"
                                  rel="nofollow noreferrer"
                                >
                                  Terms of Service
                                </Button>
                              )}
                              {privacy && (
                                <Button
                                  size="compact-sm"
                                  variant="light"
                                  component="a"
                                  href={privacy}
                                  target="_blank"
                                  rel="nofollow noreferrer"
                                >
                                  Privacy
                                </Button>
                              )}
                            </Group>
                          </Stack>
                        </Popover.Dropdown>
                      </Popover>
                    </Group>
                    <Group gap="xs" justify="space-between">
                      <Group gap="xs" wrap="nowrap">
                        {startupTime && (
                          <Tooltip {...defaultTooltipProps} label="Startup time">
                            <Badge {...defaultBadgeProps} leftSection={<IconRefresh size={14} />}>
                              {abbreviateTime(startupTime)}
                            </Badge>
                          </Tooltip>
                        )}
                        {stepsPerSecond && (
                          <Tooltip {...defaultTooltipProps} label="Image generation time">
                            <Badge {...defaultBadgeProps} leftSection={<IconPhoto size={14} />}>
                              {abbreviateTime(calculateStepsPerSecond(stepsPerSecond))}
                            </Badge>
                          </Tooltip>
                        )}
                        {price && (
                          <Tooltip {...defaultTooltipProps} label="Price">
                            <Badge {...defaultBadgeProps}>{price}</Badge>
                          </Tooltip>
                        )}
                      </Group>
                      {enabled && (
                        <Button
                          color="blue"
                          size="compact-xs"
                          px="md"
                          component="a"
                          href={`/api/run/${modelVersionId}?${QS.stringify({
                            partnerId: id,
                          })}`}
                          target="_blank"
                          rel="nofollow noreferrer"
                        >
                          <IconArrowBigRight size={20} />
                        </Button>
                      )}
                    </Group>
                  </Group>
                </Table.Td>
              </Table.Tr>
            )
          )}
          {extra}
        </Table.Tbody>
      </Table>
    );
  };

  return (
    <Stack>
      <Text>
        Want to try out this model? Use one of these services to start generating right away.
      </Text>
      {partnersLoading || strategiesLoading ? (
        <Center p="md">
          <Loader />
        </Center>
      ) : !!partnersWithStrategies?.length ? (
        <ScrollArea.Autosize mah="55vh">
          <Stack>
            {renderPremiumPartners(premiumPartners)}
            {renderPartners(availablePartners)}
            {unavailablePartners.length > 0 && (
              <>
                <Divider
                  variant="dashed"
                  labelPosition="center"
                  label={
                    <Group gap={4}>
                      <IconBan size={14} />
                      <Text>Not available</Text>
                    </Group>
                  }
                />
                {renderPartners(unavailablePartners)}
              </>
            )}
          </Stack>
        </ScrollArea.Autosize>
      ) : (
        <Alert color="yellow">
          Currently, there are no model generating services for this model
        </Alert>
      )}
      <Group gap={4}>
        <Text size="sm">{"Don't see your preferred service?"}</Text>
        <Text
          size="sm"
          component="a"
          target="_blank"
          href="https://docs.google.com/forms/d/e/1FAIpQLSdlDQXJMIhgnOjmpgEqfesPThDpxskQNau2HtxPXoLSqDMbwA/viewform"
        >
          Request that they be added
        </Text>
      </Group>
    </Stack>
  );
}

const abbreviateTime = (value: number) => {
  if (value < 60) return `${value}s`;
  else return `${Math.round(value / 60)}m`;
};

const calculateStepsPerSecond = (value: number) => {
  const parsed = 30 / value;
  if (parsed < 1) return Math.round(parsed * 10) / 10;

  return Math.round(parsed);
};
