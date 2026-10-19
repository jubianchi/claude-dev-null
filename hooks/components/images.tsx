import type { Elements } from 'claude-code'

import type { LogImage } from '../../types'
import type { KeptPicture } from '../picture'
import { shown } from '../picture'

export type ImagesProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Link'> & Partial<Pick<Elements['terminal'], 'Image'>>
  /** The commit the images are of, for their address. */
  id: string
  images: readonly LogImage[]
  /** The columns the commit's words take, the box of a picture as wide at most. */
  width?: number
  /** The picture drawn for an image, if any: none, and the image is a link, as where the surface draws no picture. */
  pictureOf?: (url: string) => KeptPicture | undefined
}

/**
 * The images of a commit: each picture drawn, its link under it, then a row of links for the others, where the
 * surface draws no picture, or the picture is not loaded.
 */
export default function Images(props: ImagesProps) {
  const { ui, id, images, width = 0, pictureOf } = props
  const { Box, Image, Link } = ui
  const label = (image: LogImage) => `[image ${image.width}×${image.height}]`
  const drawn = images.flatMap((image, index) => {
    const picture = Image === undefined ? undefined : pictureOf?.(image.url)

    return picture === undefined ? [] : [{ image, index, picture }]
  })
  const linked = images.filter(image => !drawn.some(found => found.image === image))

  return images.length === 0 ? null : (
    <Box key={`images-${id}`} flexDirection="column">
      {Image !== undefined &&
        drawn.map(({ image, index, picture }) => (
          <Box key={`picture-box-${id}-${index}`} flexDirection="column">
            <Image
              key={`picture-${id}-${index}`}
              source={{ file: picture.file, format: 'rgba', width: picture.width, height: picture.height }}
              {...shown(image, width)}
              alt={label(image)}
            />
            <Link href={image.url} label={label(image)} />
          </Box>
        ))}
      {linked.length > 0 && (
        <Box gap={1}>
          {linked.map(image => (
            <Link href={image.url} label={label(image)} />
          ))}
        </Box>
      )}
    </Box>
  )
}
