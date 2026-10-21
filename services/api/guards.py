"""Bound incoming bytes and request rate before JSON parsing or Bash analysis."""
import asyncio
import time
from collections import OrderedDict, deque

from starlette.responses import JSONResponse


class RequestGuards:
    def __init__(self, app, per_minute=30, total_per_minute=120, max_bytes=16384):
        self.app = app
        self.per_minute = per_minute
        self.total_per_minute = total_per_minute
        self.max_bytes = max_bytes
        self.clients = OrderedDict()
        self.total = deque()

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['method'] not in {'POST', 'PUT', 'PATCH'}:
            return await self.app(scope, receive, send)
        now = time.monotonic()
        client = (scope.get('client') or ('unknown',))[0]
        # Use transport identity, never an untrusted X-Forwarded-For value.
        events = self.clients.pop(client, deque())
        self.clients[client] = events
        while len(self.clients) > 10000:
            self.clients.popitem(last=False)
        for queue in (events, self.total):
            while queue and queue[0] <= now - 60:
                queue.popleft()
        if len(events) >= self.per_minute or len(self.total) >= self.total_per_minute:
            return await JSONResponse({'detail': 'Request limit reached. Try again in a minute.'},
                                      status_code=429, headers={'Retry-After': '60'})(scope, receive, send)
        events.append(now)
        self.total.append(now)
        body = bytearray()
        try:
            async with asyncio.timeout(5):
                while True:
                    message = await receive()
                    if message['type'] == 'http.disconnect':
                        return
                    body.extend(message.get('body', b''))
                    if len(body) > self.max_bytes:
                        return await JSONResponse({'detail': 'Request body exceeds 16 KiB.'},
                                                  status_code=413)(scope, receive, send)
                    if not message.get('more_body', False):
                        break
        except TimeoutError:
            return await JSONResponse({'detail': 'Request body timed out.'}, status_code=408)(scope, receive, send)

        async def bounded_receive():
            return {'type': 'http.request', 'body': bytes(body), 'more_body': False}

        await self.app(scope, bounded_receive, send)
