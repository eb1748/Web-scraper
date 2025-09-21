import React, { Component, ErrorInfo, ReactNode } from 'react';
import logger from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI.
 * Integrates with logging system for error tracking and monitoring.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    logger.error('React Error Boundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Store error info in state
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-500 text-6xl mb-6">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-6">
              We're sorry, but something unexpected happened. Please refresh the page and try again.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => window.history.back()}
                className="w-full bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Go Back
              </button>
            </div>

            {/* Error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details (Development)
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700 overflow-auto max-h-32">
                  <div className="font-semibold text-red-600 mb-1">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <pre className="whitespace-pre-wrap text-xs">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Course Error Boundary
 * Specialized error boundary for course pages with golf-specific fallback
 */
export const CourseErrorBoundary: React.FC<{ children: ReactNode; courseName?: string }> = ({
  children,
  courseName
}) => {
  const fallback = (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-green-600 text-6xl mb-6">⛳</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Course Temporarily Unavailable
        </h1>
        {courseName && (
          <p className="text-lg text-gray-700 mb-4">
            {courseName}
          </p>
        )}
        <p className="text-gray-600 mb-6">
          We're experiencing technical difficulties loading this golf course information.
          Please try again in a few moments.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <a
            href="/courses"
            className="block w-full bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Browse Other Courses
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};

/**
 * API Error Boundary
 * For components that depend heavily on API data
 */
export const APIErrorBoundary: React.FC<{
  children: ReactNode;
  apiName?: string;
  onRetry?: () => void;
}> = ({ children, apiName = 'API', onRetry }) => {
  const fallback = (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <div className="text-red-500 text-4xl mb-3">🔌</div>
      <h3 className="text-lg font-semibold text-red-800 mb-2">
        {apiName} Service Error
      </h3>
      <p className="text-red-600 mb-4">
        Unable to load data from {apiName}. This may be a temporary issue.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};

/**
 * Section Error Boundary
 * For individual page sections that can fail independently
 */
export const SectionErrorBoundary: React.FC<{
  children: ReactNode;
  sectionName: string;
  showError?: boolean;
}> = ({ children, sectionName, showError = true }) => {
  if (!showError) {
    return (
      <ErrorBoundary fallback={null}>
        {children}
      </ErrorBoundary>
    );
  }

  const fallback = (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
      <div className="text-yellow-600 text-2xl mb-2">⚠️</div>
      <p className="text-yellow-800 text-sm">
        Unable to load {sectionName}. The page will continue to work without this section.
      </p>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;