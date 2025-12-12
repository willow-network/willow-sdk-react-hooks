import { useWillowContext } from '../providers/WillowProvider';

/**
 * Main hook to access Willow client and authentication state
 */
export function useWillow() {
  const context = useWillowContext();

  return {
    client: context.client,
    session: context.session,
    isAuthenticated: context.isAuthenticated,
    isLoading: context.isLoading,
    error: context.error,
    initialize: context.initialize,
    login: context.login,
    logout: context.logout,
    registerDid: context.registerDid,
  };
}