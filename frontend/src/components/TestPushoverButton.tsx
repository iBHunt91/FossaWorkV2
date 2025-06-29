import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { sendTestNotificationChannel } from '../services/api'

interface TestPushoverButtonProps {
  enabled: boolean
  hasCredentials: boolean
  onResult: (message: string) => void
}

export default function TestPushoverButton({ enabled, hasCredentials, onResult }: TestPushoverButtonProps) {
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    setTesting(true)
    try {
      const result = await sendTestNotificationChannel('pushover')
      
      // Log everything for debugging
      console.log('Pushover test complete:', {
        result,
        type: typeof result,
        keys: Object.keys(result || {}),
        success: result?.success,
        results: result?.results,
        message: result?.message
      })
      
      // Very lenient success check - if we got a response and no error, it's probably successful
      const isSuccess = result && (
        result.success === true || 
        result.success === 'true' ||
        (result.results && (result.results.pushover === true || result.results.pushover === 'true')) ||
        (result.message && result.message.toLowerCase().includes('sent'))
      )
      
      if (isSuccess) {
        onResult('✅ Pushover test sent successfully!')
      } else {
        // If we have a specific error message, use it
        const errorMsg = result?.message || result?.error || result?.detail || 'Unknown error occurred'
        onResult(`❌ Test notification failed: ${errorMsg}`)
      }
    } catch (error: any) {
      console.error('Pushover test error:', error)
      // Check if it's a network error vs API error
      if (error.response) {
        // API returned an error
        onResult(`❌ Test failed: ${error.response.data?.detail || error.response.data?.message || error.message}`)
      } else if (error.request) {
        // Request made but no response
        onResult('❌ Test failed: No response from server')
      } else {
        // Something else
        onResult(`❌ Test failed: ${error.message}`)
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <Button
      onClick={handleTest}
      variant="outline"
      className="flex items-center gap-2 h-12"
      disabled={!enabled || !hasCredentials || testing}
    >
      <Send className="w-4 h-4" />
      <div className="text-left">
        <div className="font-medium">Pushover</div>
        <div className="text-xs text-muted-foreground">
          {enabled ? 'Enabled' : 'Disabled'}
          {hasCredentials && ' • User Key Set ✅'}
        </div>
      </div>
    </Button>
  )
}