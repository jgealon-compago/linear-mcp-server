# Linear MCP Server

Custom MCP server for Linear integration with Claude Desktop.

## What This Does

Gives Claude direct access to your Linear workspace. Once configured, you can:

- List and filter issues
- Create new issues
- Update existing issues
- View teams and projects
- Get user information

## Installation

**Update your Claude Desktop config:**

Mac/Linux: `~/.config/claude/claude_desktop_config.json`  
Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add this to your config:

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": [
        "-y",
        "github:jgealon-compago/linear-mcp-server"
      ],
      "env": {
        "LINEAR_API_KEY": "lin_api_YOUR_KEY_HERE"
      }
    }
  }
}
```

**Get your Linear API key:**

1. Go to Linear Settings → API
2. Create a Personal API key
3. Copy the key (starts with `lin_api_`)
4. Add it to your config above

**Restart Claude Desktop** after saving the config.

## Usage

Once configured, ask Claude:

- "Show me all issues in the ENG team"
- "Create a new issue: Fix login bug"
- "What teams do I have in Linear?"
- "Update issue ENG-123 to In Progress"
- "List all high priority issues"

## Available Tools

### linear_list_issues
List and filter Linear issues.

Parameters: `team`, `status`, `assignee`, `search`, `limit`

### linear_get_issue
Get details of a specific issue.

Parameters: `identifier` (required) - e.g., "ENG-123"

### linear_create_issue
Create a new issue.

Parameters: `title` (required), `teamKey` (required), `description`, `priority`, `assigneeEmail`

### linear_update_issue
Update an existing issue.

Parameters: `identifier` (required), `title`, `description`, `status`, `priority`

### linear_list_teams
List all teams in your workspace.

### linear_list_projects
List projects with optional filtering.

Parameters: `team`, `status`

### linear_get_user
Get user information.

Parameters: `email` (optional)

## Security

- Never commit API keys to version control
- Store your key only in Claude Desktop config
- Keys are passed via environment variables

## Troubleshooting

**Server won't start:**
- Verify LINEAR_API_KEY is set correctly in config
- Check Claude Desktop logs
- Ensure Node.js 18+ is installed

**Commands not working:**
- Restart Claude Desktop after config changes
- Verify Linear API key permissions
- Check team keys and issue identifiers are correct

## Built With

- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
- [@linear/sdk](https://github.com/linear/linear)

## License

MIT

---

Part of the [Personal OS](https://github.com/jgealon-compago/personal-os) project.