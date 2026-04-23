import React, { useState, useEffect } from 'react';
import { WebAuthnPasskey } from '@webauthn/passkey';

const PasskeySignIn = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passkey, setPasskey] = useState(null);

  useEffect(() => {
    const initPasskey = async () => {
      try {
        const passkey = await WebAuthnPasskey.init();
        setPasskey(passkey);
      } catch (error) {
        console.error(error);
      }
    };
    initPasskey();
  }, []);

  const handleSignIn = async (event) => {
    event.preventDefault();
    try {
      const credentials = await passkey.getCredentials();
      const response = await fetch('/api/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, credentials }),
      });
      const data = await response.json();
      if (data.success) {
        // Sign in successful, redirect to dashboard
      } else {
        // Handle sign in error
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    try {
      const credentials = await passkey.createCredentials();
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, credentials }),
      });
      const data = await response.json();
      if (data.success) {
        // Registration successful, redirect to dashboard
      } else {
        // Handle registration error
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <h1>Passkey Sign In</h1>
      <form onSubmit={handleSignIn}>
        <label>
          Username:
          <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          Password:
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button type="submit">Sign In</button>
      </form>
      <button onClick={handleRegister}>Register</button>
    </div>
  );
};

export default PasskeySignIn;