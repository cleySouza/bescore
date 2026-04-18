import { useEffect, useState } from 'react'

export function useImageFallback(src: string | undefined) {
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [src])

  return {
    imgError,
    setImgError,
  }
}
