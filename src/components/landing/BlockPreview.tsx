import type { Icon } from '@phosphor-icons/react';

import { statementCategory, statementIcon } from '../statementMeta';
import type { Statement } from '../../core/ast/types';
import './BlockPreview.css';

/** One piece of a block: a keyword, a filled field, or a variable reference. */
export type Token =
  | { kind: 'word'; text: string }
  | { kind: 'muted'; text: string }
  | { kind: 'value'; text: string; type?: 'text' | 'number' }
  | { kind: 'name'; text: string }
  | { kind: 'chip'; text: string; type: 'text' | 'number' };

export interface PreviewBlock {
  id: string;
  /** Borrowed from the real statement kinds, so hue and icon stay in step. */
  kind: Statement['kind'];
  tokens: Token[];
  /** Blocks nested inside this one, drawn indented beneath it. */
  children?: PreviewBlock[];
  /** The word introducing the nested part, e.g. "then" or "do". */
  childLabel?: string;
}

interface BlockPreviewProps {
  block: PreviewBlock;
  /** Lit up while this statement is the one running. */
  active?: boolean;
  depth?: number;
}

/**
 * A block as the landing page draws it.
 *
 * Deliberately *not* the editor's `StatementBlock`. That one is built around a
 * real AST, which is the right design for an editor and the wrong one here:
 * variable names live in the tree rather than in the dictionary, so an English
 * visitor saw English keywords wrapped around Spanish names, and the only
 * fixes were to translate the AST or to teach the editor about a marketing
 * page. Both add weight to the app to make a page look right.
 *
 * This takes plain tokens instead. Everything is translatable because
 * everything is a string the caller supplies, it can be drawn at any size, and
 * the editor never learns that the landing exists.
 *
 * What it does share is `statementCategory` and `statementIcon`, so a loop is
 * the same violet with the same icon in both places. If those change, this
 * follows automatically — which is the part that actually matters for the page
 * not to drift.
 */
export function BlockPreview({ block, active = false, depth = 0 }: BlockPreviewProps) {
  const IconComponent: Icon = statementIcon[block.kind];

  return (
    <div
      className="block-preview"
      data-category={statementCategory[block.kind]}
      data-active={active || undefined}
      data-depth={depth}
    >
      <div className="block-preview__row">
        <span className="block-preview__icon" aria-hidden="true">
          <IconComponent weight="duotone" />
        </span>

        <span className="block-preview__tokens">
          {block.tokens.map((token, index) => (
            <TokenView token={token} key={index} />
          ))}
        </span>
      </div>

      {block.children && block.children.length > 0 && (
        <div className="block-preview__nest">
          {block.childLabel && <span className="block-preview__label">{block.childLabel}</span>}
          {block.children.map((child) => (
            <BlockPreview block={child} key={child.id} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TokenView({ token }: { token: Token }) {
  if (token.kind === 'word') return <span className="block-preview__word">{token.text}</span>;
  if (token.kind === 'muted') return <span className="block-preview__muted">{token.text}</span>;
  if (token.kind === 'name') return <span className="block-preview__name">{token.text}</span>;
  if (token.kind === 'chip') {
    return (
      <span className="block-preview__chip" data-type={token.type}>
        {token.text}
      </span>
    );
  }
  return (
    <span className="block-preview__value" data-type={token.type ?? 'text'}>
      {token.text}
    </span>
  );
}
