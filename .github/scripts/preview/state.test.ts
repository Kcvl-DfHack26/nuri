import { expect, test } from 'bun:test';

import { validatePreviewPlan } from './state';

const project = 'kcvlb4';
const service = 'nuri-preview-pr-226';
const bucket = 'kcvlb4-nuri-preview-pr-226-media';
const role = 'roles/storage.objectUser';
const member = 'serviceAccount:nuri-preview-runtime@kcvlb4.iam.gserviceaccount.com';
const target = {
  project,
  region: 'asia-northeast1',
  service,
  image_bucket: bucket,
  image_role: role,
  runtime_member: member,
};

function managed(address: string, before: Record<string, string> | null) {
  return { mode: 'managed', address, change: { before } };
}

function plan(resource_changes: ReturnType<typeof managed>[]) {
  return { format_version: '1.2', errored: false, resource_changes };
}

const run = managed('google_cloud_run_v2_service.preview', {
  id: `projects/${project}/locations/asia-northeast1/services/${service}`,
  project,
  location: 'asia-northeast1',
  name: service,
});
const images = managed('google_storage_bucket.images', {
  id: bucket,
  project,
  location: 'ASIA-NORTHEAST1',
  name: bucket,
});
const iam = managed('google_storage_bucket_iam_member.runtime_images', {
  id: `b/${bucket}/${role}/${member}`,
  bucket: `b/${bucket}`,
  role,
  member,
});

test('accepts initial, legacy, partial and complete plans for the requested PR', () => {
  validatePreviewPlan(plan([managed(run.address, null)]), target);
  validatePreviewPlan(plan([run]), target);
  validatePreviewPlan(plan([images, iam]), target);
  validatePreviewPlan(plan([iam, images, run]), target);
});

test('rejects other PR resources, shared data, unexpected IAM and duplicate addresses', () => {
  const invalid = [
    [run, images, iam, iam],
    [run, { ...images, address: `module.shared.${images.address}` }],
    [run, { ...images, deposed: 'deadbeef' }],
    [run, managed('google_storage_bucket.state', { name: 'kcvlb4-nuri-preview-state' })],
    [run, managed(images.address, { id: 'kcvlb4-nuri-staging-images' })],
    [run, images, managed(iam.address, { ...iam.change.before, member: 'allUsers' })],
  ];
  for (const resources of invalid) {
    expect(() => {
      validatePreviewPlan(plan(resources), target);
    }).toThrow();
  }
  expect(() => {
    validatePreviewPlan(plan([images, iam]), {
      ...target,
      image_bucket: 'kcvlb4-nuri-preview-pr-227-media',
    });
  }).toThrow();
  expect(() => {
    validatePreviewPlan(plan([run]), { ...target, service: 'nuri-preview-pr-227' });
  }).toThrow();
});

test('rejects wrong targets even if refresh removed them from the planned changes', () => {
  const otherBucket = managed(images.address, { id: 'kcvlb4-nuri-preview-pr-227-media' });
  expect(() => {
    validatePreviewPlan({ ...plan([]), resource_drift: [otherBucket] }, target);
  }).toThrow();
  validatePreviewPlan({ ...plan([]), resource_drift: [images] }, target);
});
