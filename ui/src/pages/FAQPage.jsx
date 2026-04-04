import React from 'react';
import { Layout } from '../components/common/Layout';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';

export const FAQPage = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <PageHeader
            title="Tutorial Guide & FAQ"
            description="Learn how to use Docketra with this comprehensive guide."
          />

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Adding a Client</h2>
            <p className="text-gray-700 mb-4">
              Everything in your workspace revolves around clients. Before creating any cases, you need to set up your clients.
            </p>
            <ul className="list-disc pl-5 text-gray-700 space-y-2">
              <li>Navigate to <strong>All Clients</strong> from the sidebar.</li>
              <li>Click the <strong>Add Client</strong> button.</li>
              <li>Fill in the necessary details such as name and contact info.</li>
              <li>Once created, you can attach cases, dockets, and files directly to this client.</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Adding More Users</h2>
            <p className="text-gray-700 mb-4">
              Bring your team onboard to collaborate efficiently.
            </p>
            <ul className="list-disc pl-5 text-gray-700 space-y-2">
              <li>Go to the <strong>Team Management</strong> section under the Admin menu.</li>
              <li>Click <strong>Invite User</strong> and enter their details.</li>
              <li>Assign them a role (e.g., Admin, Employee) to manage their access.</li>
              <li>They will receive an email invitation to join the workspace.</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Adding Case Categories</h2>
            <p className="text-gray-700 mb-4">
              Case Categories help you organize and filter dockets effectively.
            </p>
            <ul className="list-disc pl-5 text-gray-700 space-y-2">
              <li>Access <strong>Firm Settings</strong> from the Admin section.</li>
              <li>Look for the Categories configuration to add new labels based on your firm's specific workflow.</li>
              <li>These categories will be available when creating a new docket.</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Creating Your First Docket</h2>
            <p className="text-gray-700 mb-4">
              A docket represents a specific piece of work or compliance task for a client.
            </p>
            <ul className="list-disc pl-5 text-gray-700 space-y-2">
              <li>Click the <strong>New Docket</strong> button in the top right corner.</li>
              <li>Select the associated client and category.</li>
              <li>Provide a clear title and description for the task.</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Using the Workbasket</h2>
            <p className="text-gray-700 mb-4">
              The Workbasket is your firm's global queue.
            </p>
            <ul className="list-disc pl-5 text-gray-700 space-y-2">
              <li>Any new docket that is created but not yet assigned to an owner lands in the <strong>Workbasket</strong>.</li>
              <li>Managers or team members can review the unassigned work here.</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Pulling a Docket to Your Worklist</h2>
            <p className="text-gray-700 mb-4">
              Take ownership of tasks to keep work moving.
            </p>
            <ul className="list-disc pl-5 text-gray-700 space-y-2">
              <li>Open the <strong>Workbasket</strong> from the sidebar.</li>
              <li>Select a docket and assign it to yourself.</li>
              <li>The docket will be removed from the global queue and placed into your <strong>My Worklist</strong>.</li>
              <li>You can now track its progress and meet deadlines efficiently.</li>
            </ul>
          </Card>

        </div>
      </div>
    </Layout>
  );
};
