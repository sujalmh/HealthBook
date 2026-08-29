import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { localVault } from '../src/core/vault/LocalVault';
beforeEach(async () => {
    await localVault.clearAll();
});
