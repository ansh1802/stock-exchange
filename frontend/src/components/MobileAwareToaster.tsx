import { Toaster } from 'sonner'
import { useIsMobile } from '../hooks/useIsMobile'

export default function MobileAwareToaster() {
  const isMobile = useIsMobile()
  return (
    <Toaster
      theme="dark"
      position={isMobile ? 'top-center' : 'bottom-right'}
      richColors
    />
  )
}
