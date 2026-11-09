import { expect, test } from 'bun:test';

import { previewImageBucket, validatePreviewState } from './state';

const project = 'kcvlb4';
const pr = '226';
const service = 'nuri-preview-pr-226';
const bucket = 'kcvlb4-nuri-preview-pr-226-media';
const role = 'roles/storage.objectUser';
const member = 'serviceAccount:nuri-preview-runtime@kcvlb4.iam.gserviceaccount.com';

function managed(type: string, name: string, attributes: Record<string, string>) {
  return { mode: 'managed', type, name, instances: [{ attributes }] };
}

const run = managed('google_cloud_run_v2_service', 'preview', {
  id: `projects/${project}/locations/asia-northeast1/services/${service}`,
  project,
  location: 'asia-northeast1',
  name: service,
});
const images = managed('google_storage_bucket', 'images', {
  id: bucket,
  project,
  location: 'ASIA-NORTHEAST1',
  name: bucket,
});
const iam = managed('google_storage_bucket_iam_member', 'runtime_images', {
  id: `b/${bucket}/${role}/${member}`,
  bucket: `b/${bucket}`,
  role,
  member,
});

test('validates empty, legacy, partial and complete state for the current PR', () => {
  expect(previewImageBucket(project, pr)).toBe(bucket);
  expect(validatePreviewState({ resources: [] }, project, pr)).toBe(false);
  expect(validatePreviewState({ resources: [run] }, project, pr)).toBe(true);
  expect(validatePreviewState({ resources: [images, iam] }, project, pr)).toBe(false);
  expect(validatePreviewState({ resources: [iam, images, run] }, project, pr)).toBe(true);
});

test('rejects other PR buckets, shared data, unexpected IAM and duplicate resources', () => {
  const invalid = [
    [run, images, iam, iam],
    [run, { ...images, module: 'module.shared' }],
    [run, managed('google_storage_bucket', 'state', { name: 'kcvlb4-nuri-preview-state' })],
    [run, managed('google_storage_bucket', 'images', { id: 'kcvlb4-nuri-staging-images' })],
    [
      run,
      images,
      managed('google_storage_bucket_iam_member', 'runtime_images', {
        id: `b/${bucket}/${role}/${member}`,
        bucket: `b/${bucket}`,
        role,
        member: 'allUsers',
      }),
    ],
  ];
  for (const resources of invalid) {
    expect(() => validatePreviewState({ resources }, project, pr)).toThrow();
  }
  expect(() => validatePreviewState({ resources: [images, iam] }, project, '227')).toThrow();
  expect(() => validatePreviewState({ resources: [run] }, project, '227')).toThrow();
});
