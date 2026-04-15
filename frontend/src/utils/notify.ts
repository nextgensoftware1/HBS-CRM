import React from 'react';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { toast, type ToastOptions } from 'react-toastify';

const baseOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 3200,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'light',
};

const icon = (Component: React.ComponentType<{ className?: string }>) =>
  () => React.createElement(Component, { className: 'h-4 w-4' });

export const notify = {
  success(message: string, options?: ToastOptions) {
    return toast.success(message, {
      ...baseOptions,
      icon: icon(FiCheckCircle),
      ...options,
    });
  },
  successOnce(message: string, toastId: string, options?: ToastOptions) {
    return toast.success(message, {
      ...baseOptions,
      icon: icon(FiCheckCircle),
      toastId,
      ...options,
    });
  },
  error(message: string, options?: ToastOptions) {
    return toast.error(message, {
      ...baseOptions,
      autoClose: 4200,
      icon: icon(FiAlertCircle),
      ...options,
    });
  },
  errorOnce(message: string, toastId: string, options?: ToastOptions) {
    return toast.error(message, {
      ...baseOptions,
      autoClose: 4200,
      icon: icon(FiAlertCircle),
      toastId,
      ...options,
    });
  },
  info(message: string, options?: ToastOptions) {
    return toast.info(message, {
      ...baseOptions,
      icon: icon(FiInfo),
      ...options,
    });
  },
  infoOnce(message: string, toastId: string, options?: ToastOptions) {
    return toast.info(message, {
      ...baseOptions,
      icon: icon(FiInfo),
      toastId,
      ...options,
    });
  },
  warning(message: string, options?: ToastOptions) {
    return toast.warning(message, {
      ...baseOptions,
      icon: icon(FiAlertTriangle),
      ...options,
    });
  },
  warningOnce(message: string, toastId: string, options?: ToastOptions) {
    return toast.warning(message, {
      ...baseOptions,
      icon: icon(FiAlertTriangle),
      toastId,
      ...options,
    });
  },
};
