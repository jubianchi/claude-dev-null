import type { Elements } from 'claude-code'

import type { LogImage } from '../../types'

export type ImagesProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Link'>
  /** The commit the images are of, for their address. */
  id: string
  images: readonly LogImage[]
}

/** The images of a commit, as links: the surfaces draw no image /dev/null serves. */
export default function Images(props: ImagesProps) {
  const { ui, id, images } = props
  const { Box, Link } = ui

  return images.length === 0 ? null : (
    <Box key={`images-${id}`} gap={1}>
      {images.map(image => (
        <Link href={image.url} label={`[image ${image.width}×${image.height}]`} />
      ))}
    </Box>
  )
}
