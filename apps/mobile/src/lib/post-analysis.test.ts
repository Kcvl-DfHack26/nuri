import type { Video } from 'react-native-compressor';

import { File } from 'expo-file-system';

import { shrinkVideo } from './post-analysis';

const mockSize = jest.fn(() => 1000);
jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({
    get size() {
      return mockSize();
    },
  })),
}));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@/lib/api', () => ({ api: {}, authClient: {} }));
const mockCompress = jest.fn<
  ReturnType<typeof Video.compress>,
  Parameters<typeof Video.compress>
>();
const mockCancel = jest.fn<void, [string]>();
jest.mock('./video-compressor', () => ({
  loadVideoCompressor: async () => ({
    compress: (...args: Parameters<typeof mockCompress>) => mockCompress(...args),
    cancelCompression: (id: string) => {
      mockCancel(id);
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('sends a video within the limit as it is', async () => {
  mockSize.mockReturnValue(29_000_000);
  await expect(shrinkVideo('file:///v.mp4', new AbortController().signal, jest.fn())).resolves.toBe(
    'file:///v.mp4',
  );
  expect(mockCompress).not.toHaveBeenCalled();
  expect(File).toHaveBeenCalledWith('file:///v.mp4');
});

test('shrinks a video over the limit to about 720p without its metadata', async () => {
  mockSize.mockReturnValue(177_000_000);
  mockCompress.mockResolvedValue('file:///small.mp4');
  const onProgress = jest.fn();
  await expect(
    shrinkVideo('file:///big.mp4', new AbortController().signal, onProgress),
  ).resolves.toBe('file:///small.mp4');
  expect(mockCompress).toHaveBeenCalledWith(
    'file:///big.mp4',
    expect.objectContaining({ maxSize: 1280, bitrate: 1_000_000, preserveMetadata: false }),
    onProgress,
  );
});

test('cancels the compression when ⑫-3 is closed', async () => {
  mockSize.mockReturnValue(177_000_000);
  const controller = new AbortController();
  mockCompress.mockImplementation(async (_uri, options) => {
    options?.getCancellationId?.('job-1');
    controller.abort();
    throw new Error('cancelled');
  });
  await expect(shrinkVideo('file:///big.mp4', controller.signal, jest.fn())).rejects.toThrow(
    'cancelled',
  );
  expect(mockCancel).toHaveBeenCalledWith('job-1');
});

test('explains a failed compression', async () => {
  mockSize.mockReturnValue(177_000_000);
  mockCompress.mockRejectedValue(new Error('codec'));
  await expect(
    shrinkVideo('file:///big.mp4', new AbortController().signal, jest.fn()),
  ).rejects.toThrow('動画を縮められませんでした。');
});
