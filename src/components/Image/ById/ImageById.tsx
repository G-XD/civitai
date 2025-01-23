import { Card, Center, Loader } from '@mantine/core';
import { AspectRatioImageCard } from '~/components/CardTemplates/AspectRatioImageCard';
import { trpc } from '~/utils/trpc';

export const ImageById = ({ imageId, ...props }: { imageId: number; className?: string }) => {
  const { data: image, isLoading } = trpc.image.get.useQuery({ id: imageId });

  if (isLoading || !image) {
    return (
      <Card {...props}>
        <Center>
          <Loader />
        </Center>
      </Card>
    );
  }

  return (
    <AspectRatioImageCard
      image={image}
      href={`/images/${image.id}`}
      target="_blank"
      aspectRatio="square"
      {...props}
    />
  );
};