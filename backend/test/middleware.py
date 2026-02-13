#!/usr/bin/env python3
"""
MCP Middleware: Connects Ollama LLM with MCP Server
Architecture:
- OllamaClient: Handles LLM interaction via HTTP API
- MCPClient: Connects to MCP server via stdio, manages tool calls
- Middleware: Main orchestration logic
"""

import json
import asyncio
import sys
import os
from typing import Any, Dict, List, Optional
from contextlib import AsyncExitStack
from pathlib import Path

import requests
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


# ============================================================================
# LLM Module (Groq API interaction)
# ============================================================================

class GroqClient:
    """Handles interaction with Groq LLM via API"""
    
    SYSTEM_PROMPT = """You are an MCP tool router.
Respond ONLY in valid JSON.
Do not explain anything.
Do not output text outside JSON.
Do not invent tools.

Output format:
{
  "tool": "<tool_name>",
  "arguments": { ... }
}

If no tool is needed, use:
{
  "tool": "none",
  "arguments": {}
}"""
    
    def __init__(self, api_key: str = None, model: str = "llama-3.1-8b-instant"):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable not set or API key not provided")
        
        self.model = model
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    def call_llm(self, user_message: str, tools_schema: List[Dict], retry: bool = True) -> Dict[str, Any]:
        """
        Call Groq LLM with user message and tool schemas.
        Returns parsed JSON response.
        """
        # Build the prompt with tool information
        tools_description = self._format_tools_for_prompt(tools_schema)
        
        full_prompt = f"""Available tools:
{tools_description}

User request: {user_message}

Respond with JSON only."""
        
        print(f"\n[LLM] Sending prompt to Groq ({self.model})...")
        print(f"[LLM] Tools available: {len(tools_schema)}")
        print(f"[LLM] Prompt length: {len(full_prompt)} characters")
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": full_prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 200,
            "response_format": {"type": "json_object"}  # Force JSON output
        }
        
        try:
            response = requests.post(self.api_url, json=payload, headers=self.headers, timeout=30)
            
            # Check for errors before raising
            if response.status_code != 200:
                print(f"\n[LLM] Groq API error (status {response.status_code}):")
                try:
                    error_data = response.json()
                    print(f"[LLM] Error details: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"[LLM] Error response: {response.text[:500]}")
                response.raise_for_status()
            
            result = response.json()
            raw_content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            print(f"\n[LLM] Raw output:\n{raw_content}")
            
            # Parse JSON
            try:
                parsed = json.loads(raw_content)
                print(f"\n[LLM] Parsed JSON: {json.dumps(parsed, indent=2)}")
                
                # Validate structure
                if "tool" not in parsed:
                    raise ValueError("Missing 'tool' field in response")
                if "arguments" not in parsed:
                    parsed["arguments"] = {}
                
                return parsed
            
            except json.JSONDecodeError as e:
                print(f"\n[LLM] JSON parsing failed: {e}")
                
                if retry:
                    print("[LLM] Retrying with correction prompt...")
                    return self._retry_with_correction(raw_content, tools_schema)
                else:
                    raise
        
        except requests.RequestException as e:
            print(f"\n[LLM] HTTP request failed: {e}")
            print(f"[LLM] Falling back to safe default (no tool)")
            # Return safe default instead of crashing
            return {"tool": "none", "arguments": {}}
    
    def _retry_with_correction(self, invalid_output: str, tools_schema: List[Dict]) -> Dict[str, Any]:
        """Retry LLM call with correction prompt"""
        tools_description = self._format_tools_for_prompt(tools_schema)
        
        correction_prompt = f"""Your previous output was invalid JSON:
{invalid_output}

Available tools:
{tools_description}

Respond with ONLY valid JSON in this exact format:
{{
  "tool": "<tool_name>",
  "arguments": {{}}
}}"""
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": correction_prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 200,
            "response_format": {"type": "json_object"}
        }
        
        try:
            response = requests.post(self.api_url, json=payload, headers=self.headers, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            raw_content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            print(f"\n[LLM] Retry raw output:\n{raw_content}")
            
            parsed = json.loads(raw_content)
            print(f"\n[LLM] Retry parsed JSON: {json.dumps(parsed, indent=2)}")
            
            if "tool" not in parsed:
                raise ValueError("Missing 'tool' field in retry response")
            if "arguments" not in parsed:
                parsed["arguments"] = {}
            
            return parsed
        
        except (requests.RequestException, json.JSONDecodeError, ValueError) as e:
            print(f"\n[LLM] Retry failed: {e}")
            # Return safe default
            return {"tool": "none", "arguments": {}}
    
    def _format_tools_for_prompt(self, tools_schema: List[Dict]) -> str:
        """Format tool schemas into readable prompt (compact version)"""
        if not tools_schema:
            return "No tools available."
        
        formatted = []
        for i, tool in enumerate(tools_schema, 1):
            name = tool.get("name", "unknown")
            description = tool.get("description", "No description")
            input_schema = tool.get("inputSchema", {})
            properties = input_schema.get("properties", {})
            required = input_schema.get("required", [])
            
            # Compact parameter format
            params_list = []
            if properties:
                for prop_name, prop_info in properties.items():
                    prop_type = prop_info.get("type", "any")
                    req_mark = "*" if prop_name in required else ""
                    params_list.append(f"{prop_name}{req_mark}:{prop_type}")
            
            params_str = ", ".join(params_list) if params_list else "none"
            
            formatted.append(f"{i}. {name}({params_str}) - {description}")
        
        return "\n".join(formatted)


# ============================================================================
# MCP Client Module (MCP connection + tool calls)
# ============================================================================

class MCPClient:
    """Manages connection to MCP server via stdio and tool execution"""
    
    def __init__(self, server_script_path: str):
        self.server_script_path = server_script_path
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
    
    async def connect(self):
        """Establish connection to MCP server"""
        print(f"\n[MCP] Connecting to server: {self.server_script_path}")
        
        # Disable viewer to prevent stdout pollution (MCP requires clean JSON-RPC on stdout)
        env = os.environ.copy()
        env['ENABLE_VIEWER'] = 'false'
        
        server_params = StdioServerParameters(
            command="node",
            args=[self.server_script_path],
            env=env
        )
        
        stdio_transport = await self.exit_stack.enter_async_context(
            stdio_client(server_params)
        )
        
        self.session = await self.exit_stack.enter_async_context(
            ClientSession(stdio_transport[0], stdio_transport[1])
        )
        
        await self.session.initialize()
        print("[MCP] Connected successfully")
    
    async def get_available_tools(self) -> List[Dict]:
        """Fetch list of available tools from MCP server"""
        if not self.session:
            raise RuntimeError("MCP client not connected")
        
        print("\n[MCP] Fetching available tools...")
        
        response = await self.session.list_tools()
        tools = []
        
        for tool in response.tools:
            tool_dict = {
                "name": tool.name,
                "description": tool.description or "No description",
                "inputSchema": tool.inputSchema
            }
            tools.append(tool_dict)
        
        print(f"[MCP] Found {len(tools)} tools:")
        for tool in tools:
            print(f"  - {tool['name']}: {tool['description']}")
        
        return tools
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Execute a tool with given arguments"""
        if not self.session:
            raise RuntimeError("MCP client not connected")
        
        print(f"\n[MCP] Calling tool: {tool_name}")
        print(f"[MCP] Arguments: {json.dumps(arguments, indent=2)}")
        
        try:
            result = await self.session.call_tool(tool_name, arguments)
            
            print(f"[MCP] Tool execution successful")
            
            # Convert MCP content objects to serializable format
            serialized_content = []
            for content_item in result.content:
                if hasattr(content_item, 'model_dump'):
                    # Pydantic v2 model
                    serialized_content.append(content_item.model_dump())
                elif hasattr(content_item, 'dict'):
                    # Pydantic v1 model
                    serialized_content.append(content_item.dict())
                else:
                    # Fallback to dict conversion
                    serialized_content.append(vars(content_item))
            
            print(f"[MCP] Result: {json.dumps(serialized_content, indent=2)}")
            
            return serialized_content
        
        except Exception as e:
            print(f"[MCP] Tool execution failed: {e}")
            raise
    
    async def close(self):
        """Close connection to MCP server"""
        print("\n[MCP] Closing connection...")
        await self.exit_stack.aclose()
        print("[MCP] Connection closed")


# ============================================================================
# Middleware Module (Main orchestration logic)
# ============================================================================

class Middleware:
    """Main middleware orchestrating LLM and MCP interaction"""
    
    def __init__(self, mcp_server_path: str, groq_api_key: str = None, 
                 model: str = "llama-3.1-8b-instant"):
        self.llm_client = GroqClient(api_key=groq_api_key, model=model)
        self.mcp_client = MCPClient(server_script_path=mcp_server_path)
        self.tools_cache: List[Dict] = []
    
    async def initialize(self):
        """Initialize middleware: connect to MCP and fetch tools"""
        print("=" * 70)
        print("MCP Middleware Initialization")
        print("=" * 70)
        
        await self.mcp_client.connect()
        self.tools_cache = await self.mcp_client.get_available_tools()
        
        print("\n" + "=" * 70)
        print("Middleware ready!")
        print("=" * 70 + "\n")
    
    async def process_user_request(self, user_input: str) -> Dict[str, Any]:
        """
        Process a user request:
        1. Send to LLM with tool schemas
        2. Parse LLM response
        3. Execute tool if needed
        4. Return result
        """
        print("\n" + "=" * 70)
        print(f"Processing user request: {user_input}")
        print("=" * 70)
        
        # Step 1: Get LLM decision
        llm_response = self.llm_client.call_llm(user_input, self.tools_cache)
        
        tool_name = llm_response.get("tool")
        arguments = llm_response.get("arguments", {})
        
        # Step 2: Execute tool if needed
        if tool_name == "none" or not tool_name:
            print("\n[Middleware] No tool execution needed")
            return {
                "status": "no_action",
                "message": "No tool was selected by the LLM"
            }
        
        # Step 3: Call the MCP tool
        try:
            result = await self.mcp_client.call_tool(tool_name, arguments)
            
            print("\n" + "=" * 70)
            print("Request completed successfully!")
            print("=" * 70)
            
            return {
                "status": "success",
                "tool": tool_name,
                "arguments": arguments,
                "result": result
            }
        
        except Exception as e:
            print(f"\n[Middleware] Error executing tool: {e}")
            return {
                "status": "error",
                "tool": tool_name,
                "arguments": arguments,
                "error": str(e)
            }
    
    async def run_interactive_loop(self):
        """Run interactive loop for user input"""
        print("\nEntering interactive mode. Type 'quit' or 'exit' to stop.\n")
        
        while True:
            try:
                user_input = input("\n👤 User: ").strip()
                
                if user_input.lower() in ['quit', 'exit', 'q']:
                    print("\nExiting...")
                    break
                
                if not user_input:
                    continue
                
                result = await self.process_user_request(user_input)
                
                print("\n" + "=" * 70)
                print("🤖 FINAL RESULT:")
                print("=" * 70)
                print(json.dumps(result, indent=2))
                print("=" * 70)
            
            except KeyboardInterrupt:
                print("\n\nInterrupted by user. Exiting...")
                break
            except Exception as e:
                print(f"\n[Error] Unexpected error: {e}")
                import traceback
                traceback.print_exc()
    
    async def shutdown(self):
        """Shutdown middleware cleanly"""
        await self.mcp_client.close()


# ============================================================================
# Main Entry Point
# ============================================================================

async def main():
    """Main entry point"""
    
    # Load environment variables from .env file in the same directory as this script
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path)
    print(f"[Config] Loaded environment from: {env_path}")
    
    # Configuration
    MCP_SERVER_PATH = "/home/aibel/Documents/Code/Minecraft/mcp-server.js"
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")  # Loaded from .env file
    MODEL = "llama-3.1-8b-instant"  # Fast Groq model (also: mixtral-8x7b-32768, llama-3.3-70b-versatile)
    
    if not GROQ_API_KEY:
        print("\n⚠️  ERROR: GROQ_API_KEY not found in .env file!")
        print(f"\nPlease add your Groq API key to: {env_path}")
        print("\nExample .env content:")
        print("  GROQ_API_KEY=your-groq-api-key-here")
        print("\nGet your free API key at: https://console.groq.com/keys")
        sys.exit(1)
    
    # Create middleware
    middleware = Middleware(
        mcp_server_path=MCP_SERVER_PATH,
        groq_api_key=GROQ_API_KEY,
        model=MODEL
    )
    
    try:
        # Initialize
        await middleware.initialize()
        
        # Run interactive loop
        await middleware.run_interactive_loop()
    
    finally:
        # Clean shutdown
        await middleware.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nShutdown complete.")
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
