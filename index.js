#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LinearClient } from '@linear/sdk';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_KEY = process.env.LINEAR_API_KEY;

if (!API_KEY) {
  console.error('LINEAR_API_KEY environment variable is required');
  process.exit(1);
}

const linear = new LinearClient({ apiKey: API_KEY });

const server = new Server(
  {
    name: 'linear-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'linear_list_issues',
        description: 'List issues from Linear. Can filter by team, status, assignee, or search term.',
        inputSchema: {
          type: 'object',
          properties: {
            team: { type: 'string', description: 'Team key (e.g., "ENG", "PROD")' },
            status: { type: 'string', description: 'Issue status (e.g., "Todo", "In Progress", "Done")' },
            assignee: { type: 'string', description: 'Assignee email or name' },
            search: { type: 'string', description: 'Search term to filter issues' },
            limit: { type: 'number', description: 'Maximum number of issues to return (default: 50)' }
          }
        }
      },
      {
        name: 'linear_get_issue',
        description: 'Get details of a specific Linear issue by ID or identifier (e.g., "ENG-123")',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: { type: 'string', description: 'Issue identifier (e.g., "ENG-123") or ID' }
          },
          required: ['identifier']
        }
      },
      {
        name: 'linear_create_issue',
        description: 'Create a new issue in Linear',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Issue title' },
            description: { type: 'string', description: 'Issue description (supports markdown)' },
            teamKey: { type: 'string', description: 'Team key (e.g., "ENG", "PROD")' },
            priority: { type: 'number', description: 'Priority (0=No priority, 1=Urgent, 2=High, 3=Normal, 4=Low)' },
            assigneeEmail: { type: 'string', description: 'Email of the assignee' }
          },
          required: ['title', 'teamKey']
        }
      },
      {
        name: 'linear_update_issue',
        description: 'Update an existing Linear issue',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: { type: 'string', description: 'Issue identifier (e.g., "ENG-123") or ID' },
            title: { type: 'string', description: 'New title' },
            description: { type: 'string', description: 'New description' },
            status: { type: 'string', description: 'New status name (e.g., "In Progress", "Done")' },
            priority: { type: 'number', description: 'New priority (0-4)' }
          },
          required: ['identifier']
        }
      },
      {
        name: 'linear_list_teams',
        description: 'List all teams in the Linear workspace',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'linear_list_projects',
        description: 'List projects in Linear',
        inputSchema: {
          type: 'object',
          properties: {
            team: { type: 'string', description: 'Filter by team key' },
            status: { type: 'string', description: 'Filter by status (planned, started, paused, completed, canceled)' }
          }
        }
      },
      {
        name: 'linear_get_user',
        description: 'Get information about the current user or a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'User email (optional, returns current user if not specified)' }
          }
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'linear_list_issues': {
        const filters = {};
        if (args.team) {
          const team = await linear.team(args.team);
          if (team) filters.team = { key: { eq: args.team } };
        }
        if (args.status) filters.state = { name: { eq: args.status } };
        if (args.assignee) {
          const users = await linear.users();
          const user = users.nodes.find(u => 
            u.email?.toLowerCase().includes(args.assignee.toLowerCase()) ||
            u.name?.toLowerCase().includes(args.assignee.toLowerCase())
          );
          if (user) filters.assignee = { id: { eq: user.id } };
        }
        const issues = await linear.issues({
          filter: Object.keys(filters).length > 0 ? filters : undefined,
          first: args.limit || 50
        });
        const formatted = issues.nodes.map(issue => ({
          id: issue.id, identifier: issue.identifier, title: issue.title,
          description: issue.description, status: issue.state?.name,
          priority: issue.priority, assignee: issue.assignee?.name,
          team: issue.team?.key, url: issue.url,
          createdAt: issue.createdAt, updatedAt: issue.updatedAt
        }));
        return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] };
      }

      case 'linear_get_issue': {
        const issue = await linear.issue(args.identifier);
        if (!issue) return { content: [{ type: 'text', text: `Issue ${args.identifier} not found` }], isError: true };
        const formatted = {
          id: issue.id, identifier: issue.identifier, title: issue.title,
          description: issue.description, status: issue.state?.name,
          priority: issue.priority, assignee: issue.assignee?.name,
          team: issue.team?.key, url: issue.url,
          createdAt: issue.createdAt, updatedAt: issue.updatedAt
        };
        return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] };
      }

      case 'linear_create_issue': {
        const team = await linear.team(args.teamKey);
        if (!team) return { content: [{ type: 'text', text: `Team ${args.teamKey} not found` }], isError: true };
        const payload = {
          title: args.title, description: args.description,
          teamId: team.id, priority: args.priority
        };
        if (args.assigneeEmail) {
          const users = await linear.users();
          const user = users.nodes.find(u => u.email === args.assigneeEmail);
          if (user) payload.assigneeId = user.id;
        }
        const result = await linear.createIssue(payload);
        const issue = await result.issue;
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true, issue: { id: issue?.id, identifier: issue?.identifier, title: issue?.title, url: issue?.url }
          }, null, 2) }]
        };
      }

      case 'linear_update_issue': {
        const issue = await linear.issue(args.identifier);
        if (!issue) return { content: [{ type: 'text', text: `Issue ${args.identifier} not found` }], isError: true };
        const updateData = {};
        if (args.title) updateData.title = args.title;
        if (args.description) updateData.description = args.description;
        if (args.priority !== undefined) updateData.priority = args.priority;
        if (args.status) {
          const states = await issue.team?.states();
          const state = states?.nodes.find(s => s.name === args.status);
          if (state) updateData.stateId = state.id;
        }
        await linear.updateIssue(issue.id, updateData);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Issue ${args.identifier} updated` }, null, 2) }] };
      }

      case 'linear_list_teams': {
        const teams = await linear.teams();
        const formatted = teams.nodes.map(team => ({ id: team.id, key: team.key, name: team.name, description: team.description }));
        return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] };
      }

      case 'linear_list_projects': {
        const filters = {};
        if (args.team) {
          const team = await linear.team(args.team);
          if (team) filters.teams = { some: { key: { eq: args.team } } };
        }
        if (args.status) filters.state = { eq: args.status };
        const projects = await linear.projects({
          filter: Object.keys(filters).length > 0 ? filters : undefined
        });
        const formatted = projects.nodes.map(project => ({
          id: project.id, name: project.name, description: project.description,
          state: project.state, url: project.url,
          startDate: project.startDate, targetDate: project.targetDate
        }));
        return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] };
      }

      case 'linear_get_user': {
        if (args.email) {
          const users = await linear.users();
          const user = users.nodes.find(u => u.email === args.email);
          if (!user) return { content: [{ type: 'text', text: `User with email ${args.email} not found` }], isError: true };
          return { content: [{ type: 'text', text: JSON.stringify({ id: user.id, name: user.name, email: user.email, active: user.active }, null, 2) }] };
        } else {
          const viewer = await linear.viewer;
          return { content: [{ type: 'text', text: JSON.stringify({ id: viewer.id, name: viewer.name, email: viewer.email, active: viewer.active }, null, 2) }] };
        }
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Linear MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});