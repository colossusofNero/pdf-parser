import { useEffect, useState } from 'react';

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

export default function ElevenLabsWidget({ form, setForm, sessionId }) {
  const [lastUpdate, setLastUpdate] = useState({});

  // Debug logging
  console.log('🔍 ElevenLabs Widget Debug:', {
    agentId,
    allEnvVars: import.meta.env,
    hasAgentId: !!agentId
  });

  // Load ElevenLabs widget script
  useEffect(() => {
    if (!agentId) {
      console.warn('⚠️ ElevenLabs widget not loading: agentId is missing');
      return;
    }

    console.log('✅ Loading ElevenLabs widget with agent ID:', agentId);

    // Add the custom elevenlabs-convai element
    const widgetElement = document.createElement('elevenlabs-convai');
    widgetElement.setAttribute('agent-id', agentId);
    document.body.appendChild(widgetElement);

    // Add ElevenLabs widget script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    script.type = 'text/javascript';
    document.body.appendChild(script);

    return () => {
      // Cleanup
      if (widgetElement.parentNode) {
        widgetElement.parentNode.removeChild(widgetElement);
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [agentId]);

  // Poll backend for session updates every 2 seconds
  useEffect(() => {
    if (!sessionId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/elevenlabs/session/${sessionId}`);
        const data = await response.json();

        if (data.success && data.data) {
          // Update form with any new fields from the conversation
          const updates = data.data;

          // Highlight fields that just changed
          Object.keys(updates).forEach(key => {
            if (updates[key] !== lastUpdate[key] && updates[key] !== null && updates[key] !== undefined) {
              // Flash the field
              const field = document.querySelector(`input[name="${key}"], select[name="${key}"], textarea[name="${key}"]`);
              if (field) {
                field.classList.add('field-updated');
                setTimeout(() => field.classList.remove('field-updated'), 2000);
              }
            }
          });

          setLastUpdate(updates);

          // Update form state - only update fields that have values
          const validUpdates = Object.fromEntries(
            Object.entries(updates).filter(([key, value]) =>
              value !== null &&
              value !== undefined &&
              value !== '' &&
              !key.includes('quote') && // Don't override quote fields
              !key.includes('submitted') &&
              !key.includes('computed')
            )
          );

          if (Object.keys(validUpdates).length > 0) {
            setForm(prev => ({
              ...prev,
              ...validUpdates
            }));
          }
        }
      } catch (error) {
        console.error('Session poll error:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [sessionId, lastUpdate, setForm, apiBase]);

  if (!agentId) {
    return null; // Don't show anything if no agent ID
  }

  // The ElevenLabs script will automatically add their widget button with the green circle
  return (
    <>
      {/* CSS for field highlighting and positioning ElevenLabs widget */}
      <style>{`
        /* Field update animation */
        @keyframes fieldUpdate {
          0% { background-color: #dbeafe; transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          50% { background-color: #bfdbfe; transform: scale(1.02); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { background-color: white; transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }

        .field-updated {
          animation: fieldUpdate 2s ease !important;
          border-color: #3b82f6 !important;
          border-width: 2px !important;
        }

        /* Position ElevenLabs widget in bottom right - let it use native sizing */
        elevenlabs-convai {
          position: fixed !important;
          bottom: 2rem !important;
          right: 2rem !important;
          z-index: 9999 !important;
        }

        /* Alternative selectors for different ElevenLabs widget versions */
        [id*="elevenlabs"],
        [class*="elevenlabs"] {
          position: fixed !important;
          bottom: 2rem !important;
          right: 2rem !important;
          z-index: 9999 !important;
        }
      `}</style>
    </>
  );
}
