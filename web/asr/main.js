/**
 * Copyright FunASR (https://github.com/alibaba-damo-academy/FunASR). All Rights
 * Reserved. MIT License  (https://opensource.org/licenses/MIT)
 */
/* 2022-2023 by zhaoming,mali aihealthx.com */


// 连接; 定义socket连接类对象与语音对象
var wsconnecter = new WebSocketConnectMethod({msgHandle:getJsonMessage,stateHandle:getConnState});
var audioBlob;

// 录音; 定义录音对象,wav格式
var rec = Recorder({
	type:"pcm",
	bitRate:16,
	sampleRate:16000,
	onProcess:recProcess
});

 
 
 
var sampleBuf=new Int16Array();
// 定义按钮响应事件
var btnStart = document.getElementById('btnStart');
btnStart.onclick = record;
var btnStop = document.getElementById('btnStop');
btnStop.onclick = stop;
btnStop.disabled = true;
btnStart.disabled = true;
 
btnConnect= document.getElementById('btnConnect');
btnConnect.onclick = start;
// 禁用自动连接，避免与视频播放冲突
btnConnect.disabled = false;
btnStart.disabled = true;
btnStop.disabled = true;

var awsslink= document.getElementById('wsslink');

 
var rec_text="";  // for online rec asr result
var offline_text=""; // for offline rec asr result
var info_div = document.getElementById('info_div');

var upfile = document.getElementById('upfile');

 

var isfilemode=false;  // if it is in file mode
var file_ext="";
var file_sample_rate=16000; //for wav file sample rate
var file_data_array;  // array to save file data
 
var totalsend=0;


// var now_ipaddress=window.location.href;
// now_ipaddress=now_ipaddress.replace("https://","wss://");
// now_ipaddress=now_ipaddress.replace("static/index.html","");
// var localport=window.location.port;
// now_ipaddress=now_ipaddress.replace(localport,"10095");
// document.getElementById('wssip').value=now_ipaddress;
addresschange();

function addresschange()
{   
	
    var Uri = document.getElementById('wssip').value; 
	document.getElementById('info_wslink').innerHTML="点此处手工授权（IOS手机）";
	Uri=Uri.replace(/wss/g,"https");
	console.log("addresschange uri=",Uri);
	
	awsslink.onclick=function(){
		window.open(Uri, '_blank');
		}
	
}

upfile.onclick=function()
{
		btnStart.disabled = true;
		btnStop.disabled = true;
		btnConnect.disabled=false;
	
}

// from https://github.com/xiangyuecn/Recorder/tree/master
var readWavInfo=function(bytes){
	//读取wav文件头，统一成44字节的头
	if(bytes.byteLength<44){
		return null;
	};
	var wavView=bytes;
	var eq=function(p,s){
		for(var i=0;i<s.length;i++){
			if(wavView[p+i]!=s.charCodeAt(i)){
				return false;
			};
		};
		return true;
	};
	
	if(eq(0,"RIFF")&&eq(8,"WAVEfmt ")){
 
		var numCh=wavView[22];
		if(wavView[20]==1 && (numCh==1||numCh==2)){//raw pcm 单或双声道
			var sampleRate=wavView[24]+(wavView[25]<<8)+(wavView[26]<<16)+(wavView[27]<<24);
			var bitRate=wavView[34]+(wavView[35]<<8);
			var heads=[wavView.subarray(0,12)],headSize=12;//head只保留必要的块
			//搜索data块的位置
			var dataPos=0; // 44 或有更多块
			for(var i=12,iL=wavView.length-8;i<iL;){
				if(wavView[i]==100&&wavView[i+1]==97&&wavView[i+2]==116&&wavView[i+3]==97){//eq(i,"data")
					heads.push(wavView.subarray(i,i+8));
					headSize+=8;
					dataPos=i+8;break;
				}
				var i0=i;
				i+=4;
				i+=4+wavView[i]+(wavView[i+1]<<8)+(wavView[i+2]<<16)+(wavView[i+3]<<24);
				if(i0==12){//fmt 
					heads.push(wavView.subarray(i0,i));
					headSize+=i-i0;
				}
			}
			if(dataPos){
				var wavHead=new Uint8Array(headSize);
				for(var i=0,n=0;i<heads.length;i++){
					wavHead.set(heads[i],n);n+=heads[i].length;
				}
				return {
					sampleRate:sampleRate
					,bitRate:bitRate
					,numChannels:numCh
					,wavHead44:wavHead
					,dataPos:dataPos
				};
			};
		};
	};
	return null;
};

upfile.onchange = function () {
　　　　　　var len = this.files.length;  
            for(let i = 0; i < len; i++) {

                let fileAudio = new FileReader();
                fileAudio.readAsArrayBuffer(this.files[i]);  
 
				file_ext=this.files[i].name.split('.').pop().toLowerCase();
                var audioblob;
                fileAudio.onload = function() {
                audioblob = fileAudio.result;
 
				 
				 file_data_array=audioblob;
 
                  
                 info_div.innerHTML='请点击连接进行识别';
 
                }

　　　　　　　　　　fileAudio.onerror = function(e) {
　　　　　　　　　　　　console.log('error' + e);
　　　　　　　　　　}
            }
			// for wav file, we  get the sample rate
			if(file_ext=="wav")
            for(let i = 0; i < len; i++) {

                let fileAudio = new FileReader();
                fileAudio.readAsArrayBuffer(this.files[i]);  
                fileAudio.onload = function() {
                audioblob = new Uint8Array(fileAudio.result);
 
				// for wav file, we can get the sample rate
				var info=readWavInfo(audioblob);
				   console.log(info);
				   file_sample_rate=info.sampleRate;
	 
 
                }

　　　　　　 
            }
 
        }

function play_file()
{
	  var audioblob=new Blob( [ new Uint8Array(file_data_array)] , {type :"audio/wav"});
	  var audio_record = document.getElementById('audio_record');
	  audio_record.src =  (window.URL||webkitURL).createObjectURL(audioblob); 
      audio_record.controls=true;
	  
	  // 移除之前可能添加的事件监听器，避免重复
	  audio_record.onplay = null;
	  audio_record.onended = null;
	  audio_record.onerror = null;
	  
	  // 添加事件监听器来处理播放状态
	  audio_record.addEventListener('play', function() {
		  console.log("Audio playback started");
		  info_div.innerHTML="正在播放音频...";
	  });
	  
	  audio_record.addEventListener('ended', function() {
		  console.log("Audio playback finished");
		  info_div.innerHTML="音频播放完成";
	  });
	  
	  audio_record.addEventListener('error', function(e) {
		  console.log("Audio playback error:", e);
		  info_div.innerHTML="音频播放出错，请检查文件格式";
	  });
	  
	  // 尝试自动播放，如果失败则需要用户手动点击播放
	  setTimeout(function() {
		  audio_record.play().catch(function(error) {
			  console.log("Auto-play failed:", error);
			  // 在界面上提示用户需要手动点击播放
			  info_div.innerHTML="文件识别完成，请点击播放按钮播放音频";
		  });
	  }, 100); // 延迟100ms播放，确保音频资源加载完成
}
function start_file_send()
{
		sampleBuf=new Uint8Array( file_data_array );
 
		var chunk_size=960; // for asr chunk_size [5, 10, 5]
 
 
 
		
 
		while(sampleBuf.length>=chunk_size){
			
		    sendBuf=sampleBuf.slice(0,chunk_size);
			totalsend=totalsend+sampleBuf.length;
			sampleBuf=sampleBuf.slice(chunk_size,sampleBuf.length);
			wsconnecter.wsSend(sendBuf);
 
		 
		}
 
		stop();
 
 
 
}
 
	
function on_recoder_mode_change()
{
            var item = null;
            var obj = document.getElementsByName("recoder_mode");
            for (var i = 0; i < obj.length; i++) { //遍历Radio 
                if (obj[i].checked) {
                    item = obj[i].value;  
					break;
                }
		    
 
           }
		    if(item=="mic")
			{
				document.getElementById("mic_mode_div").style.display = 'block';
				document.getElementById("rec_mode_div").style.display = 'none';
 
 
		        btnStart.disabled = true;
		        btnStop.disabled = true;
		        btnConnect.disabled=false;
				isfilemode=false;
			}
			else
			{
				document.getElementById("mic_mode_div").style.display = 'none';
				document.getElementById("rec_mode_div").style.display = 'block';
 
		        btnStart.disabled = true;
		        btnStop.disabled = true;
		        btnConnect.disabled=true;
			    isfilemode=true;
				info_div.innerHTML='请点击选择文件';
			    
	 
			}
}
 

function getHotwords(){
	
	var obj = document.getElementById("varHot");

	if(typeof(obj) == 'undefined' || obj==null || obj.value.length<=0){
	  return null;
	}
	let val = obj.value.toString();
  
	console.log("hotwords="+val);
	let items = val.split(/[(\r\n)\r\n]+/);  //split by \r\n
	var jsonresult = {};
	const regexNum = /^[0-9]*$/; // test number
	for (item of items) {
  
		let result = item.split(" ");
		if(result.length>=2 && regexNum.test(result[result.length-1]))
		{ 
			var wordstr="";
			for(var i=0;i<result.length-1;i++)
				wordstr=wordstr+result[i]+" ";
  
			jsonresult[wordstr.trim()]= parseInt(result[result.length-1]);
		}
	}
	console.log("jsonresult="+JSON.stringify(jsonresult));
	return  JSON.stringify(jsonresult);

}
function getAsrMode(){
 
            var item = null;
            var obj = document.getElementsByName("asr_mode");
            for (var i = 0; i < obj.length; i++) { //遍历Radio 
                if (obj[i].checked) {
                    item = obj[i].value;  
					break;
                }
		    
 
           }
            if(isfilemode)
			{
				item= "offline";
			}
		   console.log("asr mode"+item);
		   
		   return item;
}
		   
function handleWithTimestamp(tmptext,tmptime)
{
	console.log( "tmptext: " + tmptext);
	console.log( "tmptime: " + tmptime);
    if(tmptime==null || tmptime=="undefined" || tmptext.length<=0)
	{
		return tmptext;
	}
	tmptext=tmptext.replace(/。|？|，|、|\?|\.|\ /g, ","); // in case there are a lot of "。"
	var words=tmptext.split(",");  // split to chinese sentence or english words
	var jsontime=JSON.parse(tmptime); //JSON.parse(tmptime.replace(/\]\]\[\[/g, "],[")); // in case there are a lot segments by VAD
	var char_index=0; // index for timestamp
	var text_withtime="";
	for(var i=0;i<words.length;i++)
	{   
	if(words[i]=="undefined"  || words[i].length<=0)
	{
		continue;
	}
    console.log("words===",words[i]);
	console.log( "words: " + words[i]+",time="+jsontime[char_index][0]/1000);
	if (/^[a-zA-Z]+$/.test(words[i]))
	{   // if it is english
		text_withtime=text_withtime+jsontime[char_index][0]/1000+":"+words[i]+"\n";
		char_index=char_index+1;  //for english, timestamp unit is about a word
	}
	else{
        // if it is chinese
		text_withtime=text_withtime+jsontime[char_index][0]/1000+":"+words[i]+"\n";
		char_index=char_index+words[i].length; //for chinese, timestamp unit is about a char
	}
	}
	return text_withtime;
	

}

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))
async function is_speaking() {
	const response = await fetch('/is_speaking', {
		body: JSON.stringify({
			sessionid: parseInt(parent.document.getElementById('sessionid').value),
		}),
		headers: {
			'Content-Type': 'application/json'
		},
		method: 'POST'
	  });
	const data = await response.json();
	console.log('is_speaking res:',data)
	return data.data
}

async function waitSpeakingEnd() {
	// 不关闭录音，保持连接状态
	for(let i=0;i<10;i++) {  //等待数字人开始讲话，最长等待10s
		try {
			bspeak = await is_speaking()
			if(bspeak) {
				break
			}
		} catch(e) {
			console.log("Error checking speaking status:", e)
			break
		}
		await sleep(1000)
	}

	while(true) {  //等待数字人讲话结束
		try {
			bspeak = await is_speaking()
			if(!bspeak) {
				break
			}
		} catch(e) {
			console.log("Error checking speaking status:", e)
			break
		}
		await sleep(1000)
	}
	// 保持WebSocket连接，不关闭录音
	await sleep(2000)
	// 确保连接仍然活跃
	if (!wsconnecter.isConnected()) {
		console.log("WebSocket disconnected, attempting to reconnect...")
		start()
	}
}
// 语音识别结果; 对jsonMsg数据解析,将识别结果附加到编辑框中
function getJsonMessage( jsonMsg ) {
	//console.log(jsonMsg);
	console.log( "message: " + JSON.parse(jsonMsg.data)['text'] );
	var rectxt=""+JSON.parse(jsonMsg.data)['text'];
	var asrmodel=JSON.parse(jsonMsg.data)['mode'];
	var is_final=JSON.parse(jsonMsg.data)['is_final'];
	var timestamp=JSON.parse(jsonMsg.data)['timestamp'];
	if(asrmodel=="2pass-offline" || asrmodel=="offline")
	{
		offline_text=offline_text+rectxt.replace(/ +/g,"")+'\n'; //handleWithTimestamp(rectxt,timestamp); //rectxt; //.replace(/ +/g,"");
		rec_text=offline_text;
		fetch('/human', {
            body: JSON.stringify({
                text: rectxt.replace(/ +/g,""),
                type: 'chat',
				sessionid:parseInt(parent.document.getElementById('sessionid').value),
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST'
      	}).then(response => {
			// 确保连接保持活跃
			if (!wsconnecter.isConnected()) {
				console.log("WebSocket disconnected after fetch, attempting to reconnect...")
				start()
			}
		}).catch(error => {
			console.log("Error sending message to human endpoint:", error)
		});

		waitSpeakingEnd();
	}
	else
	{
		// 检查是否是最终识别结果
		if (is_final == true) {
			// 如果是最终结果，累加到rec_text并重置临时变量
			rec_text = rec_text + rectxt; //.replace(/ +/g,"");
			// 可以在这里添加处理最终结果的代码
		} else {
			// 如果不是最终结果，只是临时显示
			var varArea=document.getElementById('varArea');
			varArea.value = rec_text + rectxt; //.replace(/ +/g,"");
			return; // 不继续执行下面的代码
		}
	}
	var varArea=document.getElementById('varArea');
	
	varArea.value=rec_text;
	console.log( "offline_text: " + asrmodel+","+offline_text);
	console.log( "rec_text: " + rec_text);
	if (isfilemode==true && is_final==true){
		console.log("call stop ws!");
		play_file();
		// 不再关闭WebSocket连接，保持连接状态
		// wsconnecter.wsStop();
        
		info_div.innerHTML="文件识别完成";
 
		btnStart.disabled = true;
		btnStop.disabled = true;
		btnConnect.disabled=false;
	}
	
	// 确保WebSocket连接保持活跃
	if (!wsconnecter.isConnected()) {
		console.log("WebSocket disconnected in getJsonMessage, attempting to reconnect...")
		// 不立即重新连接，而是在稍后重试
		setTimeout(function() {
			if (!wsconnecter.isConnected()) {
				start()
			}
		}, 1000)
	}
 
}

// 连接状态响应
function getConnState( connState ) {
	if ( connState === 0 ) { //on open
 

 
		info_div.innerHTML='连接成功!请点击开始';
		if (isfilemode==true){
			info_div.innerHTML='请耐心等待,大文件等待时间更长';
			start_file_send();
		}
		else
		{
			btnStart.disabled = false;
			btnStop.disabled = true;
			btnConnect.disabled=true;
		}
	} else if ( connState === 1 ) {
		//stop();
	} else if ( connState === 2 ) {
		stop();
		console.log( 'connecttion error' );
		 
		alert("连接地址"+document.getElementById('wssip').value+"失败,请检查asr地址和端口。或试试界面上手动授权，再连接。");
		btnStart.disabled = true;
		btnStop.disabled = true;
		btnConnect.disabled=false;
 
 
		info_div.innerHTML='请点击连接';
	}
}

function record()
{
	isRec = true; // 确保设置录音状态为true
	clear(); // 清除之前的识别结果
		 rec.open( function(){
		 rec.start();
		 console.log("开始");
			btnStart.disabled = true;
			btnStop.disabled = false;
			btnConnect.disabled=true;
		 });
 
}

 

// 识别启动、停止、清空操作
function start() {
	
	// 清除显示
	clear();
	//控件状态更新
 	console.log("isfilemode"+isfilemode);
    
	//检查连接状态，如果已经连接则直接开始，否则启动连接
	if(wsconnecter.isConnected()) {
		info_div.innerHTML="已连接asr服务器";
		isRec = true;
		btnStart.disabled = true;
		btnStop.disabled = false;
		btnConnect.disabled=true;
 
        return 1;
	} else {
		//启动连接
		var ret=wsconnecter.wsStart();
		// 1 is ok, 0 is error
		if(ret==1){
			info_div.innerHTML="正在连接asr服务器，请等待...";
			isRec = true;
			btnStart.disabled = true;
			btnStop.disabled = true;
			btnConnect.disabled=true;
	 
			return 1;
		}
		else
		{
			info_div.innerHTML="请点击开始";
			btnStart.disabled = true;
			btnStop.disabled = true;
			btnConnect.disabled=false;
	 
			return 0;
		}
	}
}

 
function stop() {
		var chunk_size = new Array( 5, 10, 5 );
		var request = {
			"chunk_size": chunk_size,
			"wav_name":  "h5",
			"is_speaking":  false,
			"chunk_interval":10,
			"mode":getAsrMode(),
		};
		console.log(request);
		if(sampleBuf.length>0){
		wsconnecter.wsSend(sampleBuf);
		console.log("sampleBuf.length"+sampleBuf.length);
		sampleBuf=new Int16Array();
		}
	   wsconnecter.wsSend( JSON.stringify(request) );
 
	  
	

 
	// 控件状态更新
	
	isRec = false;
    info_div.innerHTML="发送完数据,请等候,正在识别...";
 
   if(isfilemode==false){
	    btnStop.disabled = true;
		btnStart.disabled = false; // 允许重新开始录音
		btnConnect.disabled=true;
		// 不再关闭WebSocket连接，保持连接状态
		// 3s后更新提示信息
	  setTimeout(function(){
		info_div.innerHTML="识别完成，点击开始进行下一次录音";}, 3000 );
 
 
	   
	// 不完全停止录音，而是暂停录音以保持连接
	rec.stop(function(blob,duration){
  
		console.log(blob);
		var audioBlob = Recorder.pcm2wav(data = {sampleRate:16000, bitRate:16, blob:blob},
		function(theblob,duration){
				console.log(theblob);
		var audio_record = document.getElementById('audio_record');
		audio_record.src =  (window.URL||webkitURL).createObjectURL(theblob); 
        audio_record.controls=true;
		
		// 移除之前可能添加的事件监听器，避免重复
		audio_record.onplay = null;
		audio_record.onended = null;
		audio_record.onerror = null;
		
		// 添加事件监听器来处理播放状态
		audio_record.addEventListener('play', function() {
			console.log("Audio playback started");
			info_div.innerHTML="正在播放录音...";
		});
		
		audio_record.addEventListener('ended', function() {
			console.log("Audio playback finished");
			info_div.innerHTML="录音播放完成";
		});
		
		audio_record.addEventListener('error', function(e) {
			console.log("Audio playback error:", e);
			info_div.innerHTML="录音播放出错";
		});
		
		// 尝试自动播放，如果失败则需要用户手动点击播放
		setTimeout(function() {
			audio_record.play().catch(function(error) {
				console.log("Auto-play failed:", error);
				info_div.innerHTML="录音已完成，请点击播放按钮播放";
			});
		}, 100); // 延迟100ms播放，确保音频资源加载完成
         	
 
	}   ,function(msg){
		 console.log(msg);
	}
		);
 
 
 
	},function(errMsg){
		console.log("errMsg: " + errMsg);
	});
   } else {
	   // 文件模式下不需要录音处理，但需要保持WebSocket连接
	   console.log("File mode: keeping WebSocket connection alive");
   }
    // 保持WebSocket连接活跃，不完全关闭连接
	// 只在必要时重新连接，而不是完全断开
	if (!wsconnecter.isConnected()) {
		console.log("WebSocket disconnected in stop function");
		// 可以选择在这里重新连接，但我们保持连接状态
	}
 
	
 
}

function clear() {
 
    var varArea=document.getElementById('varArea');
 
	varArea.value="";
    rec_text="";
	offline_text="";
 
}

 
function recProcess( buffer, powerLevel, bufferDuration, bufferSampleRate,newBufferIdx,asyncEnd ) {
	if ( isRec === true ) {
		var data_48k = buffer[buffer.length-1];  
 
		var  array_48k = new Array(data_48k);
		var data_16k=Recorder.SampleData(array_48k,bufferSampleRate,16000).data;
 
		sampleBuf = Int16Array.from([...sampleBuf, ...data_16k]);
		var chunk_size=960; // for asr chunk_size [5, 10, 5]
		info_div.innerHTML=""+bufferDuration/1000+"s";
		while(sampleBuf.length>=chunk_size){
		    sendBuf=sampleBuf.slice(0,chunk_size);
			sampleBuf=sampleBuf.slice(chunk_size,sampleBuf.length);
			wsconnecter.wsSend(sendBuf);
			
			
		 
		}
		
		
 
	}
}

function getUseITN() {
	var obj = document.getElementsByName("use_itn");
	for (var i = 0; i < obj.length; i++) {
		if (obj[i].checked) {
			return obj[i].value === "true";
		}
	}
	return false;
}