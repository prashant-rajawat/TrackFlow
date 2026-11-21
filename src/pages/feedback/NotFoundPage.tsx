import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '../../components/common/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-700">
          <HelpCircle className="w-7 h-7" />
        </div>

        <div className="text-4xl font-bold font-mono tracking-tight text-slate-900 mb-2">
          404
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-2">
          Page Not Found
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          The address you requested does not exist in TrackFlow. It might have been moved or entered incorrectly.
        </p>

        <div className="flex justify-center">
          <Button
            variant="primary"
            size="md"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};
