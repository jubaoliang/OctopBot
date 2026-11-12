import {
  isKnowledgeFolder,
  knowledgeChildPrefix,
  knowledgeDocumentId,
  knowledgeDocumentLabel,
} from '../knowledge-tree';

describe('knowledgeDocumentId', () => {
  it('prefers id, then document_id', () => {
    expect(knowledgeDocumentId({ id: 'a', document_id: 'b' })).toBe('a');
    expect(knowledgeDocumentId({ document_id: 'b' })).toBe('b');
    expect(knowledgeDocumentId({})).toBe('');
  });
});

describe('isKnowledgeFolder', () => {
  it('is true only when is_dir is exactly true', () => {
    expect(isKnowledgeFolder({ is_dir: true })).toBe(true);
    expect(isKnowledgeFolder({ is_dir: false })).toBe(false);
    expect(isKnowledgeFolder({})).toBe(false);
  });
});

describe('knowledgeChildPrefix', () => {
  it('returns the document path for deepening the tree', () => {
    expect(knowledgeChildPrefix({ path: 'docs/guides' })).toBe('docs/guides');
  });
});

describe('knowledgeDocumentLabel', () => {
  it('prefers filename, then name, then path basename', () => {
    expect(knowledgeDocumentLabel({ filename: 'a.md', path: 'x/a.md' })).toBe('a.md');
    expect(knowledgeDocumentLabel({ filename: '', name: 'named', path: 'x/y' })).toBe('named');
    expect(knowledgeDocumentLabel({ filename: '', path: 'folder/leaf' })).toBe('leaf');
  });
});
