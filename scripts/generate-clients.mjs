#!/usr/bin/env zx
import 'zx/globals';
import * as c from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor as renderJavaScriptVisitor } from '@codama/renderers-js';
import { renderVisitor as renderRustVisitor } from '@codama/renderers-rust';

// Instanciate Codama.
const idlPath = path.join(
  __dirname,
  '..',
  'idls',
  'testudo_testudo_bonds.json'
);
const idl = rootNodeFromAnchor(require(idlPath));
const codama = c.createFromRoot(idl);

// Update programs.
codama.update(
  c.updateProgramsVisitor({
    testudoTestudoBonds: { name: 'testudoBonds' },
  })
);

// Update accounts with PDA seeds.
codama.update(
  c.updateAccountsVisitor({
    Admin: {
      name: 'globalAdmin',
      seeds: [c.constantPdaSeedNodeFromString('utf8', 'global_admin')],
    },
    UserAccount: {
      name: 'userPda',
      seeds: [
        c.constantPdaSeedNodeFromString('utf8', 'user'),
        c.variablePdaSeedNode(
          'userWallet',
          c.publicKeyTypeNode(),
          'The wallet of the user'
        ),
      ],
    },
    Bond: {
      seeds: [
        c.constantPdaSeedNodeFromString('utf8', 'bond'),
        c.variablePdaSeedNode(
          'userPda',
          c.publicKeyTypeNode(),
          'The user PDA account'
        ),
        c.variablePdaSeedNode(
          'bondIndex',
          c.numberTypeNode('u8'),
          'The bond index'
        ),
      ],
    },
  })
);

// Update instructions with default values and account relationships.
codama.update(
  c.updateInstructionsVisitor({
    initializeAdmin: {
      byteDeltas: [
        c.instructionByteDeltaNode(c.accountLinkNode('globalAdmin')),
      ],
      accounts: {
        globalAdmin: { defaultValue: c.pdaValueNode('globalAdmin') },
      },
    },
    createUser: {
      byteDeltas: [c.instructionByteDeltaNode(c.accountLinkNode('userPda'))],
      accounts: {
        userPda: { defaultValue: c.pdaValueNode('userPda') },
      },
    },
    initializeBond: {
      byteDeltas: [c.instructionByteDeltaNode(c.accountLinkNode('bond'))],
      accounts: {
        bond: { defaultValue: c.pdaValueNode('Bond') },
        globalAdmin: { defaultValue: c.pdaValueNode('globalAdmin') },
        userPda: { defaultValue: c.pdaValueNode('userPda') },
      },
    },
    processClaim: {
      accounts: {
        bond: { defaultValue: c.pdaValueNode('Bond') },
        globalAdmin: { defaultValue: c.pdaValueNode('globalAdmin') },
        userPda: { defaultValue: c.pdaValueNode('userPda') },
        newBondPda: { defaultValue: c.pdaValueNode('Bond') },
      },
    },
    updateAdmin: {
      accounts: {
        globalAdmin: { defaultValue: c.pdaValueNode('globalAdmin') },
      },
    },
  })
);

// Render JavaScript.
const jsClient = path.join(__dirname, '..', 'clients', 'js');
codama.accept(
  renderJavaScriptVisitor(path.join(jsClient, 'src', 'generated'), {
    prettierOptions: require(path.join(jsClient, '.prettierrc.json')),
    solanaLibrary: '@solana/kit',
  })
);

// Render Rust.
const rustClient = path.join(__dirname, '..', 'clients', 'rust');
codama.accept(
  renderRustVisitor(path.join(rustClient, 'src', 'generated'), {
    formatCode: true,
    crateFolder: rustClient,
  })
);
