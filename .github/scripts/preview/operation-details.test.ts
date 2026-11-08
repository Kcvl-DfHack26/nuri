import { expect, test } from 'bun:test';

import { operationDetails } from './operation-details';

const address = 'google_cloud_run_v2_service.preview';
const service = {
  name: 'nuri-preview-pr-148',
  ingress: 'INGRESS_TRAFFIC_ALL',
  scaling: [{ min_instance_count: 0, max_instance_count: 1 }],
  template: [
    {
      timeout: '180s',
      containers: [
        {
          image: 'us-docker.pkg.dev/cloudrun/container/hello',
          env: [{ name: 'SECRET', value: 'hidden-env-value' }],
          resources: [{ limits: { cpu: '1', memory: '2Gi' } }],
        },
      ],
    },
  ],
};

test('shows the created preview service and its planned settings', () => {
  const log = operationDetails(
    {
      resource_changes: [
        { address, change: { actions: ['create'], before: null, after: service } },
      ],
    },
    'apply',
  ).join('\n');
  expect(log).toContain('Cloud Run service: nuri-preview-pr-148');
  expect(log).toContain(
    'Resource ID: projects/kcvlb4/locations/asia-northeast1/services/nuri-preview-pr-148',
  );
  expect(log).toContain('Action: create');
  expect(log).toContain('service min instances: — → 0');
  expect(log).toContain('memory limit: — → 2Gi');
  expect(log).not.toContain('hidden-env-value');
});

test('shows changed settings and omits sensitive and unknown values', () => {
  const change = {
    actions: ['update'],
    before: service,
    after: {
      ...service,
      ingress: 'INGRESS_TRAFFIC_INTERNAL_ONLY',
      scaling: [{ min_instance_count: 1, max_instance_count: 3 }],
      template: [{ timeout: null }],
    },
    after_sensitive: { scaling: [{ min_instance_count: true }] },
    after_unknown: { scaling: [{ max_instance_count: true }] },
  };
  const log = operationDetails({ resource_changes: [{ address, change }] }, 'apply').join('\n');
  expect(log).toContain('Action: update');
  expect(log).toContain('ingress: INGRESS_TRAFFIC_ALL → INGRESS_TRAFFIC_INTERNAL_ONLY');
  expect(log).toContain('request timeout: 180s → —');
  expect(log).not.toContain('service min instances');
  expect(log).not.toContain('service max instances');
  expect(log).not.toContain('hidden-env-value');
});

test('shows the Destroy target and settings from the preceding state', () => {
  const resource = {
    address,
    values: {
      ...service,
      template: [{ containers: [{ image: 'https://example.com/image?token=secret' }] }],
    },
  };
  const log = operationDetails(
    { values: { root_module: { resources: [resource] } } },
    'destroy',
  ).join('\n');
  expect(log).toContain('Cloud Run service: nuri-preview-pr-148');
  expect(log).toContain('Action: delete');
  expect(log).toContain('service max instances: 1');
  expect(log).not.toContain('token=secret');
});
