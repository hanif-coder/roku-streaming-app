# Roku Streaming App – API Reference

Base URL (development): `http://localhost:5001`  
All responses are JSON. Use the `videoId` from Search when calling the Video endpoint.

---

## Health Check

**GET** `/health`

Check if the API is running.

**Response** `200 OK`
```json
{
  "success": true,
  "message": "API running"
}
```

---

## Search API

**GET** `/api/search`

Search for videos. Returns up to 10 results. Use `videoId` from each item to request playback details from the Video API.

### Query parameters

| Parameter | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| `q`       | string | Yes      | Search keyword. Minimum 2 characters. |

### Success response

**Status:** `200 OK`

```json
{
  "success": true,
  "total": 10,
  "data": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Video Title",
      "author": "Channel Name",
      "lengthSeconds": 212,
      "thumbnails": [
        {
          "url": "https://...",
          "width": 320,
          "height": 180
        }
      ]
    }
  ]
}
```

| Field          | Type   | Description                                      |
|----------------|--------|--------------------------------------------------|
| `success`      | boolean| Always `true` on success.                         |
| `total`        | number | Number of items returned (max 10).               |
| `data`         | array  | List of video objects.                           |
| `data[].videoId`   | string | Use this as `id` in the Video API.           |
| `data[].title`     | string | Video title.                                 |
| `data[].author`     | string | Channel / author name.                        |
| `data[].lengthSeconds` | number | Duration in seconds.                    |
| `data[].thumbnails`   | array  | Thumbnail objects (url, width, height).     |

### Error responses

| Status | Condition                    | Body example |
|--------|-----------------------------|--------------|
| `400`  | `q` missing or empty        | `{ "success": false, "message": "Query parameter \"q\" is required" }` |
| `400`  | `q` shorter than 2 characters | `{ "success": false, "message": "Query \"q\" must be at least 2 characters" }` |
| `500`  | Search service unavailable or misconfigured | `{ "success": false, "message": "Upstream search failed" }` or `"Search service is not configured"` |

### Example (Roku / cURL)

```bash
curl "http://localhost:5001/api/search?q=music"
```

---

## Video API

**GET** `/api/video`

Get video metadata and a stream URL for playback. Use the `videoId` from the Search API as the `id` parameter.

### Query parameters

| Parameter | Type   | Required | Description        |
|-----------|--------|----------|--------------------|
| `id`      | string | Yes      | Video ID (e.g. from Search `videoId`). |

### Success response

**Status:** `200 OK`

```json
{
  "success": true,
  "videoId": "dQw4w9WgXcQ",
  "title": "Video Title",
  "author": "Channel Name",
  "lengthSeconds": 212,
  "streamUrl": "https://...",
  "expireAt": 1735689600
}
```

| Field         | Type   | Description |
|---------------|--------|-------------|
| `success`     | boolean| Always `true` on success. |
| `videoId`     | string | Video ID. |
| `title`       | string | Video title. |
| `author`      | string | Channel / author name. |
| `lengthSeconds` | number | Duration in seconds. |
| `streamUrl`   | string | HLS or MP4 URL for playback. Use this in your Roku video node. |
| `expireAt`    | number \| null | Unix timestamp when the stream URL expires; refresh before this time. |

### Error responses

| Status | Condition                    | Body example |
|--------|-----------------------------|--------------|
| `400`  | `id` missing or empty        | `{ "success": false, "message": "Query parameter \"id\" is required" }` |
| `404`  | Video not found              | `{ "success": false, "message": "Video not found" }` |
| `502`  | No playable stream for video | `{ "success": false, "message": "No suitable stream found for this video" }` |
| `500`  | Upstream request failed      | `{ "success": false, "message": "Upstream video request failed" }` |
| `503`  | Video service unavailable    | `{ "success": false, "message": "Video service unavailable" }` |

### Example (Roku / cURL)

```bash
curl "http://localhost:5001/api/video?id=dQw4w9WgXcQ"
```

---

## Roku integration notes

1. **Search → Video flow**  
   Call `/api/search?q=...` to get a list of `videoId`s, then call `/api/video?id=<videoId>` for each video you want to play.

2. **Playback**  
   Use the `streamUrl` from the Video API in your Roku `Video` or `Audio` node (e.g. `contentUrl`). Prefer HLS when the client supports it.

3. **Expiration**  
   If `expireAt` is present, request a new `/api/video?id=...` response before that Unix time to get a fresh `streamUrl`.

4. **Errors**  
   All error responses use `success: false` and a `message` string. Use HTTP status code and `message` for user-facing error handling.

5. **Base URL**  
   In production, replace `http://localhost:5001` with your server’s base URL. The API supports CORS for browser and Roku usage.
