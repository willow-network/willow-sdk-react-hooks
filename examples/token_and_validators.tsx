/**
 * Willow React Hooks - Token and Validator Operations Example
 *
 * This example demonstrates economic operations:
 * 1. Query token information
 * 2. Check DID balances
 * 3. Check app balances
 * 4. View fee schedules
 * 5. List validators
 * 6. View validator details
 * 7. View staking statistics
 *
 * Prerequisites:
 * - npm install @willow/react-hooks @willow/sdk
 * - Run a local Willow node
 */

import React, { useState } from 'react';
import {
  WillowProvider,
  useWillow,
  useAuth,
  useTokenInfo,
  useBalance,
  useAppBalance,
  useFeeSchedule,
  useToken,
  useValidators,
  useValidator,
  useValidatorSet,
} from '@willow/react-hooks';

function TokenValidatorContent() {
  const { isAuthenticated, session } = useWillow();
  const { generateAndRegister, isGenerating, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Willow Token & Validator Demo</h1>
        <button onClick={() => generateAndRegister()} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate DID & Login'}
        </button>
      </div>
    );
  }

  return <AuthenticatedContent did={session!.did} onLogout={logout} />;
}

function AuthenticatedContent({
  did,
  onLogout,
}: {
  did: string;
  onLogout: () => void;
}) {
  const [selectedApp, setSelectedApp] = useState<string>('demo-app');
  const [selectedValidator, setSelectedValidator] = useState<string | null>(null);

  // ============ TOKEN HOOKS ============

  // Token info
  const { tokenInfo, isLoading: tokenInfoLoading, error: tokenInfoError } = useTokenInfo();

  // DID balance
  const { balance, isLoading: balanceLoading, error: balanceError } = useBalance(did);

  // App balance
  const {
    balance: appBalance,
    isLoading: appBalanceLoading,
    error: appBalanceError,
  } = useAppBalance(selectedApp);

  // Fee schedule
  const { feeSchedule, isLoading: feeLoading, error: feeError } = useFeeSchedule();

  // Combined token hook (convenience)
  const { fundApp, transfer, isFunding, isTransferring } = useToken(did);

  // ============ VALIDATOR HOOKS ============

  // List validators
  const {
    validators,
    isLoading: validatorsLoading,
    error: validatorsError,
    refetch: refetchValidators,
  } = useValidators();

  // Get specific validator
  const { validator, isLoading: validatorLoading } = useValidator(selectedValidator);

  // Validator set (with computed totals)
  const { validatorSet, isLoading: validatorSetLoading } = useValidatorSet();

  // Handle validator selection
  const handleSelectValidator = (validatorDid: string) => {
    setSelectedValidator(validatorDid);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Willow Token & Validator Demo</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <p>
          <strong>Authenticated as:</strong> {did.substring(0, 30)}...
        </p>
        <button onClick={onLogout}>Logout</button>
      </div>

      {/* ============ TOKEN SECTION ============ */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ borderBottom: '2px solid #1976d2', paddingBottom: '10px' }}>
          💰 Token Operations
        </h2>

        {/* Token Info */}
        <section style={{ marginBottom: '30px' }}>
          <h3>1. Token Information</h3>
          {tokenInfoLoading ? (
            <p>Loading token info...</p>
          ) : tokenInfoError ? (
            <p style={{ color: 'red' }}>Error: {tokenInfoError.message}</p>
          ) : tokenInfo ? (
            <div style={{ background: '#e3f2fd', padding: '10px' }}>
              <p>
                <strong>Name:</strong> {tokenInfo.name}
              </p>
              <p>
                <strong>Symbol:</strong> {tokenInfo.symbol}
              </p>
              <p>
                <strong>Decimals:</strong> {tokenInfo.decimals}
              </p>
              <p>
                <strong>Total Supply:</strong> {tokenInfo.totalSupply?.toLocaleString()}
              </p>
            </div>
          ) : (
            <p>No token info available</p>
          )}
        </section>

        {/* Account Balance */}
        <section style={{ marginBottom: '30px' }}>
          <h3>2. Your Account Balance</h3>
          {balanceLoading ? (
            <p>Loading balance...</p>
          ) : balanceError ? (
            <p style={{ color: 'red' }}>Error: {balanceError.message}</p>
          ) : balance ? (
            <div style={{ background: '#e8f5e9', padding: '10px' }}>
              <p>
                <strong>Available:</strong> {balance.available?.toLocaleString() || 0} WILL
              </p>
              <p>
                <strong>Locked:</strong> {balance.locked?.toLocaleString() || 0} WILL
              </p>
              <p>
                <strong>Total:</strong> {balance.total?.toLocaleString() || 0} WILL
              </p>
            </div>
          ) : (
            <p>Balance: 0 WILL</p>
          )}
        </section>

        {/* App Balance */}
        <section style={{ marginBottom: '30px' }}>
          <h3>3. App Balance</h3>
          <div style={{ marginBottom: '10px' }}>
            <label>
              App ID:{' '}
              <input
                type="text"
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                style={{ padding: '5px' }}
              />
            </label>
          </div>
          {appBalanceLoading ? (
            <p>Loading app balance...</p>
          ) : appBalanceError ? (
            <p style={{ color: 'orange' }}>App not found or no balance</p>
          ) : appBalance !== undefined ? (
            <div style={{ background: '#fff3e0', padding: '10px' }}>
              <p>
                <strong>App Balance:</strong> {appBalance?.toLocaleString() || 0} WILL
              </p>
            </div>
          ) : (
            <p>No app balance data</p>
          )}
        </section>

        {/* Fee Schedule */}
        <section style={{ marginBottom: '30px' }}>
          <h3>4. Fee Schedule</h3>
          {feeLoading ? (
            <p>Loading fee schedule...</p>
          ) : feeError ? (
            <p style={{ color: 'red' }}>Error: {feeError.message}</p>
          ) : feeSchedule ? (
            <div style={{ background: '#fce4ec', padding: '10px' }}>
              <p>
                <strong>Storage per byte:</strong> {feeSchedule.storagePerByte || 'N/A'} WILL
              </p>
              <p>
                <strong>Query fee:</strong> {feeSchedule.queryFee || 'N/A'} WILL
              </p>
              <p>
                <strong>Transaction fee:</strong> {feeSchedule.transactionFee || 'N/A'} WILL
              </p>
            </div>
          ) : (
            <p>No fee schedule available</p>
          )}
        </section>
      </div>

      {/* ============ VALIDATOR SECTION ============ */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ borderBottom: '2px solid #388e3c', paddingBottom: '10px' }}>
          🔒 Validator Operations
        </h2>

        {/* List Validators */}
        <section style={{ marginBottom: '30px' }}>
          <h3>5. Active Validators</h3>
          {validatorsLoading ? (
            <p>Loading validators...</p>
          ) : validatorsError ? (
            <p style={{ color: 'red' }}>Error: {validatorsError.message}</p>
          ) : (
            <div>
              <p>Total validators: {validators.length}</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>DID</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Stake</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Voting Power</th>
                    <th style={{ padding: '8px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {validators.slice(0, 5).map((v: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>{v.did?.substring(0, 20)}...</td>
                      <td style={{ padding: '8px' }}>
                        <span
                          style={{
                            color: v.status === 'active' ? 'green' : 'orange',
                          }}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {v.stake?.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{v.votingPower}%</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleSelectValidator(v.did)}
                          style={{ fontSize: '12px' }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => refetchValidators()} style={{ marginTop: '10px' }}>
                Refresh
              </button>
            </div>
          )}
        </section>

        {/* Validator Details */}
        {selectedValidator && (
          <section style={{ marginBottom: '30px' }}>
            <h3>6. Validator Details</h3>
            {validatorLoading ? (
              <p>Loading validator details...</p>
            ) : validator ? (
              <div style={{ background: '#e8f5e9', padding: '10px' }}>
                <p>
                  <strong>DID:</strong> {validator.did}
                </p>
                <p>
                  <strong>Status:</strong> {validator.status}
                </p>
                <p>
                  <strong>Stake:</strong> {validator.stake?.toLocaleString()} WILL
                </p>
                <p>
                  <strong>Voting Power:</strong> {validator.votingPower}%
                </p>
                <button onClick={() => setSelectedValidator(null)}>Close</button>
              </div>
            ) : (
              <p>Validator not found</p>
            )}
          </section>
        )}

        {/* Validator Set Summary */}
        <section style={{ marginBottom: '30px' }}>
          <h3>7. Validator Set Summary</h3>
          {validatorSetLoading ? (
            <p>Loading validator set...</p>
          ) : validatorSet ? (
            <div style={{ background: '#f3e5f5', padding: '10px' }}>
              <p>
                <strong>Total Validators:</strong> {validatorSet.totalValidators}
              </p>
              <p>
                <strong>Active Validators:</strong> {validatorSet.activeValidators}
              </p>
              <p>
                <strong>Total Staked:</strong> {validatorSet.totalStaked?.toLocaleString()} WILL
              </p>
              <p>
                <strong>Total Voting Power:</strong> {validatorSet.totalVotingPower}
              </p>
            </div>
          ) : (
            <p>No validator set data</p>
          )}
        </section>
      </div>

      {/* Economic Model Summary */}
      <section style={{ marginTop: '40px', padding: '20px', background: '#e8f5e9' }}>
        <h3>Economic Model Summary</h3>
        <ul>
          <li>💰 WILL token for storage fees and staking</li>
          <li>📊 Pay-per-storage model (automatic deduction)</li>
          <li>🔒 Validators secure the network via Proof of Stake</li>
          <li>🔍 Indexers earn rewards for indexing work</li>
          <li>⚡ Apps fund storage to enable data operations</li>
        </ul>
      </section>
    </div>
  );
}

export default function TokenAndValidatorsExample() {
  return (
    <WillowProvider
      config={{
        apiUrl: 'http://localhost:3031',
      }}
    >
      <TokenValidatorContent />
    </WillowProvider>
  );
}
