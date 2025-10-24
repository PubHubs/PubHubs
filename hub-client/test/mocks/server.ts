// Tests
import { handlers } from './handlers';
// Packages
import { setupServer } from 'msw/node';

// This configures a request mocking server with the given request handlers.
export const server = setupServer(...handlers);
