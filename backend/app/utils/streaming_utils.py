"""
Streaming utilities for large data operations to prevent memory issues
"""
import json
import asyncio
from typing import AsyncGenerator, Dict, Any, List, Iterator
from fastapi.responses import StreamingResponse
import aiofiles

class JSONStreamer:
    """Stream large JSON data to prevent memory overload"""
    
    @staticmethod
    async def stream_json_array(data: List[Dict[str, Any]], chunk_size: int = 100) -> AsyncGenerator[str, None]:
        """Stream a large JSON array in chunks"""
        yield "["
        
        for i, item in enumerate(data):
            if i > 0:
                yield ","
            
            # Stream individual items
            yield json.dumps(item)
            
            # Yield control every chunk_size items to prevent blocking
            if i % chunk_size == 0:
                await asyncio.sleep(0.001)  # Small delay to yield control
        
        yield "]"
    
    @staticmethod
    async def stream_json_object(data: Dict[str, Any], chunk_size: int = 50) -> AsyncGenerator[str, None]:
        """Stream a large JSON object in chunks"""
        yield "{"
        
        items = list(data.items())
        for i, (key, value) in enumerate(items):
            if i > 0:
                yield ","
            
            # Stream key-value pairs
            yield f'"{key}": {json.dumps(value)}'
            
            # Yield control every chunk_size items
            if i % chunk_size == 0:
                await asyncio.sleep(0.001)
        
        yield "}"
    
    @staticmethod
    def create_streaming_response(generator: AsyncGenerator[str, None], filename: str = None) -> StreamingResponse:
        """Create a FastAPI StreamingResponse from a generator"""
        headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
        }
        
        if filename:
            headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        
        return StreamingResponse(generator, headers=headers)

class FileStreamer:
    """Stream large files to prevent memory overload"""
    
    @staticmethod
    async def stream_large_file(file_path: str, chunk_size: int = 8192) -> AsyncGenerator[bytes, None]:
        """Stream a large file in chunks"""
        async with aiofiles.open(file_path, 'rb') as file:
            while chunk := await file.read(chunk_size):
                yield chunk
    
    @staticmethod
    async def stream_text_file(file_path: str, chunk_size: int = 8192) -> AsyncGenerator[str, None]:
        """Stream a large text file in chunks"""
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
            while chunk := await file.read(chunk_size):
                yield chunk

class DataProcessor:
    """Process large datasets without loading everything into memory"""
    
    @staticmethod
    async def process_large_dataset(data: Iterator[Dict[str, Any]], 
                                  processor_func: callable,
                                  batch_size: int = 1000) -> AsyncGenerator[Dict[str, Any], None]:
        """Process large dataset in batches"""
        batch = []
        
        for item in data:
            batch.append(item)
            
            if len(batch) >= batch_size:
                # Process batch
                processed_batch = await processor_func(batch)
                for processed_item in processed_batch:
                    yield processed_item
                
                # Clear batch and yield control
                batch = []
                await asyncio.sleep(0.001)
        
        # Process remaining items
        if batch:
            processed_batch = await processor_func(batch)
            for processed_item in processed_batch:
                yield processed_item

async def export_work_orders_stream(work_orders: List[Dict[str, Any]]) -> StreamingResponse:
    """Export work orders as streaming JSON to prevent memory issues"""
    
    async def generate_json():
        """Generate JSON stream for work orders"""
        yield '{\n  "export_info": {\n'
        yield f'    "total_records": {len(work_orders)},\n'
        yield f'    "export_date": "{json.dumps(str(datetime.now()))[1:-1]}",\n'
        yield '    "format": "streaming_json"\n'
        yield '  },\n'
        yield '  "work_orders": [\n'
        
        for i, order in enumerate(work_orders):
            if i > 0:
                yield ',\n'
            
            # Stream each work order
            yield f'    {json.dumps(order, indent=4).replace(chr(10), chr(10) + "    ")}'
            
            # Yield control every 10 records
            if i % 10 == 0:
                await asyncio.sleep(0.001)
        
        yield '\n  ]\n}'
    
    from datetime import datetime
    
    filename = f"work_orders_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return JSONStreamer.create_streaming_response(generate_json(), filename)

async def export_large_logs_stream(logs: List[Dict[str, Any]]) -> StreamingResponse:
    """Export large log files as streaming JSON"""
    
    async def generate_logs_json():
        """Generate streaming JSON for large log exports"""
        yield '{\n  "logs": [\n'
        
        for i, log_entry in enumerate(logs):
            if i > 0:
                yield ',\n'
            
            yield f'    {json.dumps(log_entry)}'
            
            # Yield control frequently for logs (they can be huge)
            if i % 50 == 0:
                await asyncio.sleep(0.001)
        
        yield '\n  ]\n}'
    
    from datetime import datetime
    filename = f"logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return JSONStreamer.create_streaming_response(generate_logs_json(), filename)