// --- UPDATE HERE ---
var results = [{"entry":"advay-pal-0.gif","score":33.333},{"entry":"ang-ray-yan-1.gif","score":80},{"entry":"cao-wei-0.gif","score":57.778},{"entry":"chan-yu-feng-0.gif","score":63.333},{"entry":"chan-yu-feng-1.gif","score":72.222},{"entry":"chan-yu-feng-2.gif","score":86.667},{"entry":"chia-hui-yim-0.gif","score":25.455},{"entry":"david-jonathan-ten-0.gif","score":70.714},{"entry":"derek-nam-0.gif","score":67.5},{"entry":"duan-yichen-0.gif","score":55.385},{"entry":"gerald-wong-0.gif","score":41.429},{"entry":"goh-yi-rui-0.gif","score":65.556},{"entry":"herbert-ilhan-tanujaya-0.gif","score":50.769},{"entry":"herbert-ilhan-tanujaya-2.gif","score":62.727},{"entry":"irvin-lim-0.gif","score":63.333},{"entry":"jamos-tay-0.gif","score":56.667},{"entry":"jamos-tay-1.gif","score":80},{"entry":"jiayee-0.gif","score":60},{"entry":"kenneth-tan-xin-you-0.gif","score":62.727},{"entry":"kian-jia-ren-0.gif","score":74.167},{"entry":"kian-jia-ren-1.gif","score":58},{"entry":"kian-jia-ren-2.gif","score":53},{"entry":"le-minh-duc-0.gif","score":51},{"entry":"le-minh-duc-1.gif","score":50},{"entry":"le-minh-duc-2.gif","score":30},{"entry":"lee-yan-hwa-0.gif","score":42.5},{"entry":"leon-mak-0.gif","score":47.273},{"entry":"leon-mak-1.gif","score":47.778},{"entry":"leon-mak-2.gif","score":36.923},{"entry":"li-kai-0.gif","score":77.5},{"entry":"li-kai-1.gif","score":56.667},{"entry":"li-kai-2.gif","score":61.667},{"entry":"li-shuang-0.gif","score":30},{"entry":"lim-jie-0.gif","score":35},{"entry":"loh-jia-shun-kenneth-0.gif","score":71.538},{"entry":"loh-jia-shun-kenneth-1.gif","score":61.25},{"entry":"loh-jia-shun-kenneth-2.gif","score":52.5},{"entry":"louis-tan-jun-an-1.gif","score":52.308},{"entry":"mohd-irfan-0.gif","score":24.167},{"entry":"mohd-irfan-1.gif","score":36.25},{"entry":"mohd-irfan-2.gif","score":44.167},{"entry":"ong-qi-yong-0.gif","score":44.444},{"entry":"pang-zheng-yu-2.gif","score":60},{"entry":"ram-janarthan-0.gif","score":57.273},{"entry":"sherina-toh-0.gif","score":82.5},{"entry":"shi-xiyue-2.gif","score":60},{"entry":"syed-abdullah-0.gif","score":34},{"entry":"tang-yew-siang-0.gif","score":64},{"entry":"tang-yew-siang-1.gif","score":56},{"entry":"tang-yew-siang-2.gif","score":76.667},{"entry":"wong-kang-fei-0.gif","score":84.167},{"entry":"wong-kang-fei-1.gif","score":77.5},{"entry":"wong-kang-fei-2.gif","score":76.25},{"entry":"xiao-pu-1.gif","score":69.286},{"entry":"yu-peng-chua-0.gif","score":58.571},{"entry":"yuan-yuchuan-0.gif","score":55.556},{"entry":"zhang-hanming-1.gif","score":67.5},{"entry":"zhuolin-zuo-0.gif","score":40.769},{"entry":"zhuolin-zuo-1.gif","score":52.5},{"entry":"zhuolin-zuo-2.gif","score":48.462}];
var folder = '3d'; // download and extract tarball, here solutions are in ./3d/
var extension = '.gif';
// --- UPDATE ABOVE --

var fs = require('fs');
var count = require('./count-tokens').count;

var entries = fs.readdirSync(folder);

var finalScore = {};


for (var i = 0; i < results.length; i ++) {
	finalScore[results[i].entry] = {"votes": results[i].score};
}

for (var i = 0; i < entries.length; i ++) {
	try {
		var counted = count(fs.readFileSync(folder + '/' + entries[i], 'utf8'));
	} catch (e) {
		console.log(entries[i]);
		console.log(e);
		continue;
	}
	var filename = getImageName(entries[i]);
	for (var j = 0; j < counted.length; j++) {
		var entryName = filename + '-' + getEntryId(counted[j].name) + extension;
		if (finalScore[entryName] != undefined) {
			finalScore[entryName].count = counted[j].count;
			finalScore[entryName].score = finalScore[entryName].votes -
				Math.pow(2, counted[j].count / 50);
		}
	}
}

for (var entry in finalScore) {
	if (finalScore.hasOwnProperty(entry)) {
		console.log(entry + '\t' + finalScore[entry].votes + '\t' 
			+ finalScore[entry].count + '\t' + finalScore[entry].score);
	};
}

function getImageName(filename) {
	var start = 4;
	var end = filename.length - 21;
	return filename.substring(start, end);
}

function getEntryId(name) {
	return name.substring(name.length - 1, name.length);
}