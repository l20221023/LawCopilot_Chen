export function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0) {
    return '0 B'
  }

  if (size < 1024) {
    return `${size} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

export function getFileExtension(fileName: string) {
  const segments = fileName.split('.')

  if (segments.length <= 1) {
    return ''
  }

  return segments.at(-1)?.toLowerCase() ?? ''
}

export function readFileAsText(file: File) {
  return file.text()
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Failed to read file preview.'))
    }

    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file preview.'))
    }

    reader.readAsDataURL(file)
  })
}
