import React, { useState } from 'react';
            import type { NextPage } from 'next';
            import { WebAuthnPasskey } from '@components/WebAuthnPasskey';

            const PasskeyRegister: NextPage = () => {
              const [registered, setRegistered] = useState(false);

              const handleRegister = async () => {
                // Implement passkey registration logic here
                setRegistered(true);
              };

              return (
                <div>
                  <h1>Passkey Registration</h1>
                  {registered ? (
                    <p>Passkey registered successfully!</p>
                  ) : (
                    <WebAuthnPasskey onRegister={handleRegister} />
                  )}
                </div>
              );
            };

            export default PasskeyRegister;