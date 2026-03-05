import { Mic, MicOff, Loader } from 'lucide-react';
import { useVoiceStore } from '../../store/voiceStore';

export default function StateIndicator() {
  const { state } = useVoiceStore();
 
  const stateConfig = {
    idle: {
      icon: MicOff,
      color: 'bg-gray-600',
      text: 'Ready',
      pulse: false,
      spin: false,
    },
    listening: {
      icon: Mic,
      color: 'bg-red-500',
      text: 'Listening...',
      pulse: true,
      spin: false
    },
    processing: {
      icon: Loader,
      color: 'bg-blue-500',
      text: 'Processing...',
      pulse: false,
      spin: true
    }
  };

  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <div className="flex justify-center items-center gap-4 my-3">
      <div className="flex justify-center items-center my-3">
        <div className={`p-3 rounded-full text-center ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}>
          <Icon className={`w-6 h-6 text-white ${config.spin ? 'animate-spin' : ''}`} />
        </div>
        <h3 className="text-white font-semibold text-lg">{config.text}</h3>
        <div className="h-1 bg-gray-700 rounded-full mt-2 overflow-hidden">
          {(state === 'listening' || state === 'processing') && (
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '100%' }} />
          )}
        </div>
      </div>
    </div>
  );
}