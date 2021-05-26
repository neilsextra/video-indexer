# Video Indexer

This is a sample of application of how to use the Azure Video Indexer and uplad large videos in chunks and store these videos in 
Azure Blob.

Requires an Azure Subscription, a Blob Storage Account, Azure Search and Cognitive Service Subscription.
This project uploads and splits it in 10K chunks (which can be altered - increades/decreased) and stored in an Azure Block Blob Storage. This video then sent to to the Azure Video Indexer for analysis and processing. The progress is then monitored though a timer which examines the progress every 30 seconds. Once the vido has downloaded, the Azure Indexer will do its magic and both the 'breakdown' and thumbnails associated with the video are stored a Azure Blob Container. All metadata is stored within an Azure Table.
 
# considerations

Azure Viz is a simple Video Indexer example that store the videos within Azure Blob

To allow for larger upload sizes than 10M change the web.conf within the 'site' directory

This directive will allow the upload of large files:

 ```xml
 <requestLimits maxAllowedContentLength="4294967295"/>
 ```

This is the complete XML entry:
 ```xml
  <security>
      <requestFiltering>
        <hiddenSegments>
          <remove segment="bin"/>
        </hiddenSegments>
        <requestLimits maxAllowedContentLength="4294967295"/>
      </requestFiltering>
    </security>
```

| Field         | Meaning               | 
| ------------- |:---------------------:|
| accoundId | The Subscription Id | 
| videoSub | The Video Subscription Key |
| searchKey | The Azure Search Key | 
| blobKey | The Azure Storage Key - Block Blob| 

To run this in test create a file keys.json



```json
{
    "accountId": "01284b6a-...",
    "videoSub": "ae8037e...",
    "searchKey": "60C34...",
    "blobKey": "Wei8fnyFQiU6Mj..."
}
```
