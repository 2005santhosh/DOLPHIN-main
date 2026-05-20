import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Info } from './Icons';

const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle2 size={16} />,
    error:   <XCircle size={16} />,
    info:    <Info size={16} />,
  };

  return (
    <div className={`toast-notification toast-${type}`}>
      {icons[type]} <span>{message}</span>
    </div>
  );
};

export default Toast;
