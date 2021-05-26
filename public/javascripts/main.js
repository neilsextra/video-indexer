/**
 * Constants
 * 
 */
const CHUNK_SIZE = 10000;
const KEYWORD_OFFSET = 180;

/**
 * Globals
 * 
 * 
 */
var videoPlayer = null;
var videoBreakdown = null;
var swiper = null;

 /**
 * Get the Canvas Mouse Position
 * 
 * @param {canvas} canvas the Canvas
 * @param {event} evt the Mouse Event 
 */
function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
 
     return {
         x: evt.clientX - rect.left,
         y: evt.clientY - rect.top
     };
 
 }

 /**
  * Inactivate the Tabs
  */
 function inactivateTabs() {
    var iTab, tabcontent, tabbuttons, tablinks;
     
     // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (iTab = 0; iTab < tabcontent.length; iTab++) {
        tabcontent[iTab].style.display = "none";
    }
  
    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (iTab = 0; iTab < tablinks.length; iTab++) {
        tablinks[iTab].className = tablinks[iTab].className.replace(" active", "");
        tablinks[iTab].style.textDecoration = "none";
    }

 }

 /**
 * Show the Active Tab
 * 
 * @param {*} evt the Tab to Show
 * @param {*} tab the name of the Tab
 * @param {*} button the Tab's button
 * @api private
 * 
 */
function showTab(evt, tab, button) {

    inactivateTabs();

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tab).style.display = "block";
    document.getElementById(button).style.textDecoration = "underline";
 
    evt.currentTarget.className += " active";

}

/**
 * Clear the Canvas by removing and re-inserting the canvas
 * 
 * @param {String} containerID the container
 * @param {String} canvasID the canvas to clear
 * @api private
 * 
 */
function clearCanvas(parentID, canvasID) {
$(`#${canvasID}`).remove(); 

$(`#${parentID}`).append(`<canvas id=${canvasID} ` + 
                    `width='300' height='300' style="position:absolute; left:0px; right:0px; top:0px; bottom:0px; margin-left:auto; margin-right:auto;"/>`);

}

/**
 * Play from a position
 * 
 * @param {string} position to play the video
 * @api private
 * 
 */
function playSelection(position) {
     var time = position.split(':');

    var seconds = (+time[0]) * 60 * 60 + (+time[1]) * 60 + (+time[2]);
    videoPlayer.currentTime(seconds); 
 
    return null;

}

/**
 * Video Player - to play selected videos
 * 
 * @param {string} name name of the file   
 * @param {string} fileUrl the file url  
 * @param {string} guid the GUID  
 * @param {string} thumbnailUrl the Thumbnail url 
 * @param {string} breakdownUrl the Breakdown url   
 * @param {string} blobUri the Blob uri 
 * @param {string} container the Container name 
 * @param {string} progress the Indexing Progress  
 * @api private
 * 
 */
function playVideo(name, fileUrl, guid, thumbnailUrl, breakdownUrl, blobUri, container, progress) {  
    var url = fileUrl;

    showBreakdown(guid, breakdownUrl, thumbnailUrl, blobUri, container, progress);

    $('#playerFrame').css('display', 'inline-block');
    $('#placeHolder').css('display', 'none');
 
    document.getElementById('player').style.display = 'inline-block';   
    
    var options = {
        controls: true,
        controlBar: {
            pictureInPictureToggle: false
        },
        autoplay: false,
        preload: 'auto'};
    
    if (videoPlayer != null) {
        videoPlayer.dispose();
        $('#videoContainer').html("<video id='vid1' class='video-js' style='position:absolute; width:100%; height:100%; margin-left: auto; margin-right: auto;'></video>");
    }

    videoPlayer = videojs('vid1', options, function onPlayerReady() {
    
        this.play();
        
        // How about an event listener?
        this.on('ended', function() {
        });
    });

    videoPlayer.src(
            {type: 'video/mp4',
             src: fileUrl});
    
}

/**
 * Create a swiper control
 * @return the newly constructed swiper control
 * 
 */
function createSwipperControl() {

    var swiper = new Swiper('.swiper-container', {
      centeredSlides: false,
      watchOverflow: true,
      spaceBetween: 2,
      slidesPerView: 'auto',
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
  
    });
  
    return swiper;
  
}


  /**
   * Create Swiper Entry
   * @param {*} html the Current Swipper htmlr
   * @param {*} entry the Entry
   *  
   */
  function generateSwiperEntry(html, entry) {
    var src = (entry.thumbnailUrl == "" ? "/icons/video-indexing.svg" 
                                   : entry.thumbnailUrl);

    var result = html + "<div class='swiper-slide' style='border:2px solid white; padding:4px; background-color:rgba(255, 255, 255, 0.1);' onclick='playVideo(" +
        `"${entry.name}", "${entry.videoUrl}", "${entry.guid}", "${src}", "${entry.breakdownUrl}", "${entry.blobUri}", "${entry.container}", "${entry.processingProgress}");'> ` + 
        "<img class='swiper-image' " +
        `id=' ${entry.name}' ` + 
        `src='${src}' `+ 
        "' style='width:150px; height:100px; margin-top:20px'/> "; 

        if (entry.processingProgress != '100%') {
            var progress = entry.processingProgress;

            if (!progress.endsWith('%')) {
                progress = progress +'%';

            }

            result +=  
            `<div style='position:absolute; left:3px; bottom:20px; width:${progress}; height:20px; border:solid 2px rgb:(0,0,0); text-align:right; background-color:rgba(0, 0, 0, 0.3);'>&nbsp;${progress}</div>`;
        }

        result += "<div class='play'>" + 
        " <img src='/icons/play.svg' style='width:48px; height:48px;'/></div>" +
        " <div style='position:absolute; left:3px; bottom:10px; right:3px;'>" + 
         " <label style='color: rgba(255,255,255,0.8); font-size: 10px; width:100%; " + 
            " white-space: nowrap; overflow: hidden;text-overflow: ellipsis; display: inline-block;'>" +
        ` ${entry.name} </label>` +
        " <label style='color: rgba(255,255,255,0.8); font-size: 10px; width:100%; " + 
        " white-space: nowrap; overflow: hidden;text-overflow: ellipsis; display: inline-block;'>" +  
        ` ${entry.timestamp.replace(/[T|Z]/g, ' ')} </label>` +
        `</div></div>`;
        
    return result;

}

$(function() {

    $(window).resize(function() {
        var width = $(window).width()/2 - 690;
        $("#controls").css({left:(width)});
    });

    $('#refresh').on('click', function(e) {
        
       videoPlayer.pause();

        $('#placeHolder').css('display', 'inline-block');    
        $('#player').css('display', 'none');    
        $('#waitDialog').css('display', 'inline-block');    
        
        retrieveAll(function(html) {   
            $('#swiper-wrapper').html(html);
            $('#swiper-container').css('visibility', 'visible');  
            
            swiper = createSwipperControl();
            
            $('#swiper-container').css('visibility', 'visible');
            $('#waitDialog').css('display', 'none');    
        
        });
        
    });
         
    $('#okUploadConfirmation').on('click', function(e) {

        document.getElementById('confirmationDialog').style.display = "none";
        
    });

    $('#search').on('click', function(e) {
    });

});

/**
 * Process uploaded files
 * 
 * @param {file[]} files an array of files
 * 
 */
function processFiles(files) {

    if (videoPlayer) {
        videoPlayer.pause();
    }

    var reader = new FileReader();

    reader.onload = function() {
        var arrayBuffer = reader.result;
 
        console.log(`Chunking: ${files[0].name}`);
        chunkData(files[0].name, arrayBuffer);
        
    };

    reader.readAsArrayBuffer(files[0]);
    
}

function chunkData(filename, content) {
    var maxChunks = Math.floor(content.byteLength / CHUNK_SIZE);

    $('#waitDialog').css('display', 'inline-block');
    $('#waitMessage').text('Chunking Data : ' + content.byteLength);
    console.log('Chunking Data : ' + content.byteLength);
    
    sendData(filename, content, maxChunks).then(function(result) {
        
        if (result.status != 'OK') {
            
            $('#waitMessage').text('');
            $('#waitDialog').css('display', 'none');
 
            return;
        }

        var guid = result.guid;

        $('#waitMessage').text(`Committing : '${filename}' - ${guid}`);

        var parameters = {filename: filename,
                          guid: guid};
 
        $.get('/commit', parameters, function(result) {
            $('#waitMessage').text('Processing : ' + filename);

            $.get('/process', parameters, function(result) {

                  retrieveAll(function(html) {   
                    $('#waitMessage').text('');
                    $('#waitDialog').css('display', 'none');
                });                  
    
            }).fail(function(code, err) {
                alert(err); 
                $('#waitMessage').text('');
                $('#waitDialog').css('display', 'none');
    
            });

        }).fail(function(code, err) {
            alert(err); 
            $('#waitMessage').text('');
            $('#waitDialog').css('display', 'none');

        });

    });

}

/**
 * Send the Data to the Server in Chunks
 * 
 * @param {string} filename Video's Filename
 * @param {ArrayBuffer} video the Video Content
 * @param {integer} maxChunks Number of Posts to deliver the Video
 * 
 */
async function sendData(filename, video, maxChunks) {
    var currentChunk = 0;
    var guid = '';

    console.log(`sendData: ${filename} - ${video.byteLength}`);

    for (var iChunk=0, len = video.byteLength; iChunk<len; iChunk += CHUNK_SIZE) {   
        var chunk = video.slice(iChunk, iChunk + CHUNK_SIZE); 

        console.log(`Posting: ${filename} - ${guid}`);

        var result = await postData(filename, guid, chunk, currentChunk, maxChunks);

        console.log(`Uploaded  - [${currentChunk}/${maxChunks}] + ":" + ${result.guid} - '${filename}`);

        currentChunk += 1;

        guid = result.guid;

    }

    return {
        status: 'OK',
        guid: guid
    }

}

/**
 * Post the Data to the Server in Chunks
 * 
 * @param {string} filename Video's Filename
 * @param {string} guid Video's Unique ID - allocated by Server
 * @param {ArrayBuffer} chunk the Video Content
 * @param {integer} currentChunk Current Chunk Index
 * @param {integer} maxChunks Number of Posts to deliver the Video
 * 
 */
function postData(filename, guid, chunk, currentChunk, maxChunks) {    
    var videoContent = null;
    
    console.log(`Posting Data: ${filename}`);
 
    try {
        content = new File([chunk], filename);
    } catch (e) {
        content = new Blob([chunk], filename); 
    }

    var formData = new FormData();
    formData.append('filename', filename);  
    formData.append('guid', guid);  
    formData.append('chunk', `${currentChunk}`);
    formData.append(filename, content);

    return new Promise(resolve => {$.ajax({
        url: '/upload',
        type: 'POST',
        maxChunkSize: 10000,
        contentType: false,
        processData: false,
        async: true,
        data: formData,
            xhr: function() {
                var xhr = $.ajaxSettings.xhr();

                xhr.upload.addEventListener('progress', function (event) {
                    if (event.lengthComputable) {
                        var percentComplete = event.loaded / event.total;                          }
                }, false);

                xhr.upload.addEventListener('load', function (event) {
                }, false);

                return xhr;

            },
            error: function (err) {
                console.log(`Error: [${err.status }] - ' ${err.statusText}'`); 
                alert(`Error: [${err.status }] - ' ${err.statusText}'`);
                resolve(err);

            },
            success: function (result) {  
                $('#waitMessage').text(`Sending  - ${currentChunk}/${maxChunks}`);
                console.log(`Resolved:${result}`);
                resolve(JSON.parse(result));

            }
        });

    });

}

/**
 * Retrieve the entries
 * 
 * @param {function} callback called when completed
 */
function retrieveAll(callback) {
    var parameters = {filter:'all'};

    $.get('/retrieve', parameters, function(entries) {  
        var html = "";

        for (entry in entries) {
            html = generateSwiperEntry(html, entries[entry]);
    
        }

        callback(html);

    });

}

/**
 * Show the Breakdown
 * 
 * @param {string} guid unqiuely identifies the Video
 * @param {string} breakdownUrl the Breakdown URL
 * @param {string} thumbnailUrl the Thumbnail URL
 * @param {string} blobUri the Blob uri 
 * @param {string} container the Container nam
 * @param {string} progress the Current Progress
 * 
 */
function showBreakdown(guid, breakdownUrl, thumbnailUrl, blobUri, container, progress) {
    var parameters = {guid: guid,
                      breakdownUrl: breakdownUrl};
  
    $.get('/breakdown', parameters, function(breakdown) {

        inactivateTabs();
        videoBreakdown = breakdown;

        $('#tab').css('display', 'inline-block');
        $('#nodetails').css('display', 'none');
 
        $('#detailsFrame').css('display', 'inline-block');
        $('#tab1').css('text-decoration', 'underline');
        $('#tab1').addClass('active');

        var videoLength = Math.trunc(breakdown.summarizedInsights.duration.seconds * 10);
        
        var detailsView = `<img src='${thumbnailUrl}' style='border:2px solid rgb(255, 255, 255); width:180; height:160px; display: block; margin-top:20px; margin-bottom:30px; margin-left:auto; margin-right:auto;'/>`;
        
        detailsView += `<table style='margin-left:10px; margin-right:10px; font-size:14px; '>`;
        detailsView += `<tr><td colspan="2"><h2>Video Details</h2></td></tr>`;
        detailsView += `<tr><td style='vertical-align: top;'><b>Video Name&nbsp;<b></td>`;
        detailsView += `<td style='vertical-align: top;'>${breakdown.name}&nbsp;</td></tr>`;

        detailsView += `<tr><td style='vertical-align: top;'><b>Video Duration&nbsp;<b></td>`;
        detailsView += `<td style='vertical-align: top;'>${breakdown.durationInSeconds}&nbsp;seconds</td></tr>`;
   
        detailsView += `<tr><td>&nbsp;</td></tr>`;
 
        detailsView += `<tr><td colspan="2"><h2>Azure Details</h2></td></tr>`;
        detailsView += `<tr><td style='vertical-align: top;'><b>Folder&nbsp;<b></td>`;
        detailsView += `<td style='vertical-align: top;'>${guid}&nbsp;</td></tr>`;
   
     
        detailsView += `<tr><td style='vertical-align: top;'><b>Container&nbsp;<b></td>`;
        detailsView += `<td style='vertical-align: top;'>${container}</td></tr>`;
  
        var iFace = 1;
        var bFirst = true;
        var faces = breakdown.summarizedInsights.faces;

        for (var face in faces) {
 
            if (bFirst) {
                detailsView += `<tr><td>&nbsp;</td></tr>`;
                detailsView += `<tr><td colspan="2"><h2>Faces</h2></td></tr>`;
                detailsView += `<tr><td colspan="2">`;
                detailsView += "<table><tr>";
                bFirst = false;
             }
      
            var entry = faces[face];

            if (entry.thumbnailId) {
                var faceSrc = `${blobUri}/${container}/${guid}/${entry.thumbnailId}.jpg`;

                detailsView += '<td>';
                detailsView += `<img src='${faceSrc}' style='width:90px; height:90px;'/> `; 
                detailsView += '</td>';

                if (iFace == 5) {
                    detailsView += '</tr><tr>';
                    iFace = 0;
                }
                   
                iFace += 1; 

            }

        }
        
        if (!bFirst) {
            detailsView += '</tr></table>';
            detailsView += '</td></tr>';
        }
       
        detailsView += '</table>';
       
        $('#details').html(detailsView);

        var transcript = breakdown.videos[0].insights.transcript;
        var transcriptTable = "<table style='font-size:12px;'>";
 
        for (var id in transcript) {
            var utterance = transcript[id];
            transcriptTable += `<tr><td style='vertical-align: top;'>` +
                `<a href='javascript:;'  style='cursor: pointer; text-decoration: none;  color: black;'` + 
                ` onclick='playSelection("${utterance.instances[0].start}")'><b>${utterance.instances[0].start}&nbsp;</b></a></td>`;
            transcriptTable += `<td style='vertical-align: top;'><b>-&nbsp;</b></td>`;
            transcriptTable += `<td style='vertical-align: top;'>` +
                `<a href='javascript:;'  style='cursor: pointer; text-decoration: none;  color: black;'` + 
                ` onclick='playSelection("${utterance.instances[0].end}")'><b>${utterance.instances[0].end}&nbsp;</b></a></td>`;
            transcriptTable += `<td style='vertical-align: top; border-left: 2px solid #999999;'>&nbsp;</td>`;
            transcriptTable += `<td style='vertical-align: top;'>${utterance.text}&nbsp;</td>`;
            transcriptTable += "</tr>";
            transcriptTable += "<tr><td/><td/</tr>";

        } 

        transcriptTable += '</table>';

        $('#transcript').html(transcriptTable);

        var ocr = breakdown.videos[0].insights.ocr;

        var ocrTable = '<table>';
        var ocrTable = "<table style='font-size:12px;'>";
 
        for (var id in ocr) {
            var text = ocr[id];
            ocrTable += `<tr><td style='vertical-align: top;'>` +
            `<a href='javascript:;'  style='cursor: pointer; text-decoration: none; color: black;'` + 
            ` onclick='playSelection("${text.instances[0].start}")'><b>${text.instances[0].start}&nbsp;</b></a></td>`;
            ocrTable += `<td style='vertical-align: top;'><b>-&nbsp;</b></td>`;

            ocrTable += `<td style='vertical-align: top;'>` +
            `<a href='javascript:;'  style='cursor: pointer; text-decoration: none; color: black;'` + 
            ` onclick='playSelection("${text.instances[0].end}")'><b>${text.instances[0].end}&nbsp;</b></a></td>`;

            ocrTable += `<td style='vertical-align: top; border-left: 2px solid #999999;'>&nbsp;</td>`;
            ocrTable += `<td style='vertical-align: top;'>${text.text}&nbsp;</td>`;
            ocrTable += "</tr>";
            ocrTable += "<tr><td/><td/</tr>";

        } 

        ocrTable += '</table>';

        $('#ocr').html(ocrTable);

        var words = {}
        var keywords = 0;

         for (var keyword in breakdown.summarizedInsights.keywords) {
            var insight = breakdown.summarizedInsights.keywords[keyword];
        
            var keywordInsight = []
            
            keywords += 1;
            for (var appearance in insight.appearances) {
                var snippet = insight.appearances[appearance];
                
                var start= Math.trunc(snippet.startSeconds * 10);
                var end = Math.trunc(snippet.endSeconds * 10);

                keywordInsight.push({start:start,
                                    end : end});
                
            }

            words[insight.name] = keywordInsight;

        }

        for (var label in breakdown.summarizedInsights.labels) {
            var insight = breakdown.summarizedInsights.labels[label];
        
            var keywordInsight = []
            
            keywords += 1;
            for (var appearance in insight.appearances) {
                var snippet = insight.appearances[appearance];
                
                var start= Math.trunc(snippet.startSeconds * 10);
                var end = Math.trunc(snippet.endSeconds * 10);

                keywordInsight.push({start:start,
                                    end : end});
                
            }

            words[insight.name] = keywordInsight;

        }

        var canvas = $("#keywordsCanvas")[0];

        var ctx = canvas.getContext("2d");
        var width = canvas.width;

        canvas.setAttribute('height', `${keywords*25 + 5}`);

        var yPos = 20;
        ctx.font = "normal small-caps 20 12px Arial";
        ctx.fillStyle = "#000000";

        var playUnit = 350/videoLength
       
        for (word in words) {
            ctx.lineWidth = "1";
            ctx.strokeText(word, 10, yPos);
            var timings = words[word];
            
            ctx.beginPath();
            ctx.strokeStyle= '#AAAAAA';
            ctx.moveTo(KEYWORD_OFFSET, yPos - 6);
            ctx.lineTo(600, yPos - 6);
            ctx.stroke();
            ctx.closePath();

            ctx.strokeStyle= '#000000';
            
            ctx.beginPath();
            for (var timing in timings) {
                ctx.fillRect(KEYWORD_OFFSET + Math.trunc(timings[timing].start * playUnit), 
                         yPos - 9, 
                         Math.trunc(timings[timing].end * playUnit) - Math.trunc(timings[timing].start * playUnit), 
                         6);    
            }
            ctx.closePath();
 
            yPos += 25;

        }

        ctx.stroke();
       
        var sentimentTable = "<table style='font-size:12px;'>";
        var labels = [];
        var data = [];
        var colors = [];
        
        for (var sentiment in breakdown.summarizedInsights.sentiments) {
            var insight = breakdown.summarizedInsights.sentiments[sentiment];

            sentimentTable += `<tr><td style='vertical-align: top;'><b>${insight.sentimentKey}&nbsp;<b></td><td><table>`;
            labels.push(insight.sentimentKey);
            var coverage = 0;

            if (insight.sentimentKey == 'Negative') {
                colors.push('rgba(228, 34, 23, 0.5)');
            } else if (insight.sentimentKey == 'Positive') {
                colors.push('rgba(23, 217, 227, 0.5)');
            } else {
                colors.push('rgba(240, 255, 255, 0.5)');    
            }

            for (var instance in insight.appearances) {

                var snippet = insight.appearances[instance];
               
                sentimentTable += `<tr><td>` +
                `<a href='javascript:;' style='cursor: pointer; text-decoration: none; color: black;'` + 
                ` onclick='playSelection("${snippet.startTime}")'><b>${snippet.startTime}&nbsp;</b></a></td>`;
     
                sentimentTable += `<td>&nbsp;-&nbsp;</td>`
                sentimentTable += `<td>` +
                `<a href='javascript:;' style='cursor: pointer; text-decoration: none; color: black;'` + 
                ` onclick='playSelection("${snippet.endTime}")'><b>${snippet.endTime}&nbsp;</b></a></td></tr>`;

                var start= Math.trunc(snippet.startSeconds * 10);
                var end = Math.trunc(snippet.endSeconds * 10);  
                coverage += (end - start);
            }

            data.push(coverage);
            sentimentTable += '</table></td></tr><tr><td>&nbsp;</td></tr>'

        }

        sentimentTable += '</table>';

        $('#sentiments').html(sentimentTable);

        var options = {
        };
        
        data = {
            datasets: [{
                data: data,
                backgroundColor: colors
            }],
        
            labels: labels

        };
        
        clearCanvas('sentimentContainer', 'sentimentsCanvas');

        var sentimentChart = new Chart(document.getElementById("sentimentsCanvas").getContext("2d"), {
            type: 'pie',
            data: data,
            options: options
        });

        var shotsTable = "<table style='font-size:12px;'><tr>";
        var iShot = 0;
        
        for (var shot in breakdown.videos[0].insights.shots) {
           for (var keyFrame in breakdown.videos[0].insights.shots[shot].keyFrames) {

                for (var instance in breakdown.videos[0].insights.shots[shot].keyFrames[keyFrame].instances) {
                    var frame = breakdown.videos[0].insights.shots[shot].keyFrames[keyFrame].instances[instance];
                    var thumbnailSrc = `${blobUri}/${container}/${guid}/${frame.thumbnailId}.jpg`;

                    if (iShot % 3 == 0 && iShot != 0) {
                        shotsTable += '</tr><tr>'
                    }

                    shotsTable += '<td>'
                    shotsTable += `<img src='${thumbnailSrc}' style='cursor: pointer; width:120; height:90px;' onclick='javascript:playSelection("${frame.start}");'/> `; 
                    shotsTable += '</td>'
                    iShot += 1;
            
                }
         
           }

        }

        shotsTable += '</tr></table>';

        $('#images').html(shotsTable);

    }).fail(function() {

        $('#tab').css('display', 'none');
        $('#detailsFrame').css('display', 'none');
        $('#transcriptFrame').css('display', 'none');
        $('#ocrFrame').css('display', 'none');
        $('#keywordsFrame').css('display', 'none');
        $('#sentimentsFrames').css('display', 'none');
        $('#imagesFrame').css('display', 'none');
  
        $('#progressMessage').html('<p><b>Breakdown</b> not available</p>');

        var completed = parseInt(progress.replace('%', ''));
        var options = {
        };
        
        var data = {
            datasets: [{
                data: [completed, 100 - completed],
                backgroundColor: ['rgba(23, 217, 227, 0.5)', 'rgba(255, 255, 255, 0.6)']
            }],
        
            labels: ['Completed', 'To Do']

        };
        
        var progressChart = new Chart(document.getElementById("progressCanvas").getContext("2d"), {
            type: 'doughnut',
            data: data,
            options: {}
        });

        $('#nodetails').css('display', 'inline-block');

    });
    
}

$(document).ready(function() {
    var width = $(window).width()/2 - 690;

    $("#controls").css({left:(width)});

    $('#waitDialog').css('display', 'block');
 
    retrieveAll(function(html) {
        $('#swiper-wrapper').html(html);
        $('#swiper-container').css('visibility', 'visible');


        swiper = createSwipperControl();

        $('#swiper-container').css('visibility', 'visible');

        $('#placeHolder').css('display', 'inline-block');
        $('#waitDialog').css('display', 'none');

    });

    $('#closeUpload').on('click', function() {
        document.getElementById('uploadDialog').style.display = "none";       
    });
 
    $('#cancelVideoDelete').on('click', function() {
        document.getElementById('deleteDialog').style.display = "none";       
    });
 
    for (var iSpanClose in document.getElementsByClassName("close")) {
        var spanClose =  document.getElementsByClassName("close")[iSpanClose];

        spanClose.onclick = function() {
            var dialogs = document.getElementsByClassName("modal");

            for (var iDialog = 0; iDialog < dialogs.length; iDialog++) {
                dialogs[iDialog].style.display = "none";
            }

            if (videoPlayer) {
                videoPlayer.pause();
            }

        }

    }
    $('#keywordsCanvas')[0].addEventListener('mousemove', (evt) => {
        let mousePos = getMousePos($('#keywordsCanvas')[0], evt);

        if (mousePos.x >= KEYWORD_OFFSET) {
            $('#keywordsCanvas').css('cursor', 'pointer')
        } else {
            $('#keywordsCanvas').css('cursor', 'default')
        }
    });

    $('#keywordsCanvas')[0].addEventListener('click', (evt) => {
        let mousePos = getMousePos($('#keywordsCanvas')[0], evt);

        if (mousePos.x < KEYWORD_OFFSET) {
            return;
        }

         var videoLength = Math.trunc(videoBreakdown.summarizedInsights.duration.seconds);
        var width = $('#keywordsCanvas')[0].width - KEYWORD_OFFSET;

        var seconds = videoLength * (mousePos.x - 180)/width;
        console.log(`${mousePos.x}, ${mousePos.y}, ${videoLength}, ${seconds}`);
 
        videoPlayer.currentTime(seconds); 

    });
    
});