import {
  Anchor,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { NextLink as Link } from '~/components/NextLink/NextLink';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { NotFound } from '~/components/AppLayout/NotFound';
import { PageLoader } from '~/components/PageLoader/PageLoader';

import { ModelUpsertForm } from '~/components/Resource/Forms/ModelUpsertForm';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { trpc } from '~/utils/trpc';
import { ReadOnlyAlert } from '~/components/ReadOnlyAlert/ReadOnlyAlert';

export default function ModelEditPage() {
  const currentUser = useCurrentUser();
  const router = useRouter();
  const modelId = Number(router.query.id);
  const { data, isLoading, isError } = trpc.model.getById.useQuery({ id: modelId });
  const model = useMemo(
    () => ({
      ...data,
      tagsOnModels: data?.tagsOnModels.map(({ tag }) => tag) ?? [],
    }),
    [data]
  );

  const handleSubmit = () => {
    router.push(`/models/${modelId}`);
  };

  const isModerator = currentUser?.isModerator ?? false;
  const isOwner = model?.user?.id === currentUser?.id;

  if (isLoading) return <PageLoader />;
  if (!model || isError || (model.deletedAt && !isModerator) || (!isOwner && !isModerator))
    return <NotFound />;

  return (
    <Container size="sm">
      {isLoading && !data ? (
        <Center>
          <Loader />
        </Center>
      ) : (
        <Stack gap="xl">
          <ReadOnlyAlert
            message={
              "Civitai is currently in read-only mode and you won't be able to edit your model. Please try again later."
            }
          />
          <Link legacyBehavior href={`/models/${modelId}`} passHref>
            <Anchor size="xs">
              <Group gap={4}>
                <IconArrowLeft size={12} />
                <Text inherit>Back to {model.name} page</Text>
              </Group>
            </Anchor>
          </Link>
          <Stack gap="xs">
            <Title>Editing model</Title>
            <ModelUpsertForm model={model} onSubmit={handleSubmit}>
              {({ loading }) => (
                <Group justify="flex-end">
                  <Button type="submit" mt="xl" loading={loading}>
                    Save
                  </Button>
                </Group>
              )}
            </ModelUpsertForm>
          </Stack>
        </Stack>
      )}
    </Container>
  );
}

type Props = { modelId: number };
