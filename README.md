# azure-video-manager

This is a sample of application of how to use the Azure Video Indexer and uplad large videos in chunks and store these videos in 
Azure Blob.

Essentially, uploads and splits it in 10K chunks (which can be changed if need be) and stored in an Azure Block Blob Storage.  This is then sent to
to the Azure Video Indexer (version 2) for analysis and processing.  The progress is then monitored though a timer which examines the progress 
every 30 seconds.  Once 100% complete, stores both the 'breakdown' and thumbnails associated with the video in a Azure Blob Container. All metadata is 
store within an Azure Table.
 
# considerations

Azure Viz is a simple Video Indexer example that store the videos within Azure Blob

To allow for larger upload sizes than 10M change the web.conf within the 'site' directory

This directive will allow the upload of large files:

 ::<requestLimits maxAllowedContentLength="4294967295"/>::

This is the complete XML entry:
  ::<security>
      <requestFiltering>
        <hiddenSegments>
          <remove segment="bin"/>
        </hiddenSegments>
        <requestLimits maxAllowedContentLength="4294967295"/>
      </requestFiltering>
    </security>::


