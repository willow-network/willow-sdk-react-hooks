import { useWillowContext } from '../providers/WillowProvider';

/**
 * Main hook to access Willow client and authentication state
 */
export function useWillow() {
  const context = useWillowContext();

  return {
    client: context.client,
    config: context.config,
    isAuthenticated: context.isAuthenticated,
    hasIdentity: context.hasIdentity,
    isLoading: context.isLoading,
    error: context.error,
    initialize: context.initialize,
    setIdentity: context.setIdentity,
    clearIdentity: context.clearIdentity,
    registerDid: context.registerDid,
  };
}