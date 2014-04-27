//todo: buttons to slow or speed the cycle
//todo: button to bring up the input-terms screen again.

$(document).ready(function() {
	//get the textbox input, then call impressivetweets

	$("form").submit(function(event) {
		event.preventDefault();

		impress().init();

		var searchline = $('input[name=terms]').val() || "dogs cats";

		$("#input-terms").fadeOut(400);
		$("#loadingscreen p").fadeIn(400);
		$('body').removeClass("stop-scrolling");

		impressiveTweets(jQuery, searchline);
	});
});

var impressiveTweets = (function($, searchterms) {

	var TweetPool = function(initial, refill_at_depth) {
		this.pool = initial || [];
		this.refill_at_depth = refill_at_depth || 5;

		var that = this;

		this.push = function(arr) {
			that.pool = that.pool.concat(arr);
		};

		this.getRandom = function(howmany) {
			howmany = howmany || 1;

			if (that.pool.length >= howmany) {
				// return howmany tweets
				var result = [];

				for (var i = 0; i < howmany; i += 1) {
					var rand = randomIntFromInterval(0, that.pool.length - 1);
					result.push(that.pool[rand]);
					that.pool.splice(rand, 1);
				}

				checkDepth();

				return result;
			} else {
				console.log("Not enough tweets in the pool. Returning " + that.pool.length +
					" tweets, " + howmany + " were requested. Pool is now empty.");

				return that.clear();
			}
		};

		this.clear = function() {
			var pool = that.pool;
			that.pool = [];
			checkDepth();
			return pool;
		};

		checkDepth = function() {
			if (that.pool.length <= that.refill_at_depth) {
				$.event.trigger({
					type: "TweetPool:needrefill",
					message: "TweetPool needs to be refilled."
				});
			}
		};
	};

	function randomIntFromInterval(min, max) {
		return Math.floor(Math.random() * (max - min + 1) + min);
	}

	function fetchNewTweets(topics, matches, since_id, finished_callback) {
		//what topics, how many of each, the ID to start at, and a callback

		getTweetsForTopics(topics, matches, since_id, function(result, max_id) {
			finished_callback(removeEmpties(result), max_id);
		});


		function getTweetsForTopics(topics, matches, since_id, finished_callback) {
			//todo: throw if we get fewer tweets than expected

			var results = [];
			var max_id = 0;
			var successcount = 0;
			since_id = since_id || "459127572031614977";
			// we have to do a separate ajax request for each topic, because twitter doesn't
			// evenly balance responses between the topics
			for (var i = 0, len = topics.length; i < len; i += 1) { //for each topic
				//get tweets for that topic
				$.ajax({
					url: "https://limitless-river-8379.herokuapp.com/1.1/search/tweets.json",
					data: {
						q: topics[i],
						result_type: "recent",
						count: matches,
						language: "en"
					},
					dataType: 'jsonp',
					type: 'GET',
					success: function(data) {
						//push the retrieved tweets into storage array
						data.statuses.forEach(function(el) {
							results.push(el);
						});

						//keep the latest max_id (doesn't really need to be accurate)
						max_id = data.search_metadata.max_id_str;

						//we're finished once all ajax requests complete
						successcount++;
						if (successcount >= topics.length)
							finished_callback(removeEmpties(results), max_id);
					},

					error: function() {
						console.log("one of the ajax calls errored out.");
						//todo: retry on error.
						successcount++; // oh well...
						if (successcount >= topics.length)
							finished_callback(removeEmpties(results), max_id);
					}
				});
			}
		}


		function removeEmpties(arr) {
			var result = [];
			arr.forEach(function(e, i, a) {
				if (e) {
					result.push(e);
				}
			});
			return result;
		}
	}


	function getAllSlideIDs() {
		var slides = [];
		$.each($(".step"), function(index, val) {
			//build an array containing the ID of every step
			slides[index] = val.id;
		});
		return slides;
	}

	function getCurrentSlideFromBody() {
		var bodyClass = $("body").attr('class');
		return bodyClass.slice(bodyClass.indexOf("impress-on-") + 11);
	}

	function setOrResetCycle(duration) {
		if (typeof timing !== 'undefined')
			clearInterval(timing);
		timing = setInterval(impress().next, duration);
	}

	function updateSlidesByID(ids_to_update, tweets) {
		function getFullImage(img) {
			return img.replace("_normal", "");
		}

		function updateACS(newUpdate) {
			//merge new and old, overwriting old entries as necessary.
			$.extend(true, allCurrentSlides, newUpdate);
		}

		if (ids_to_update.length != tweets.length) {
			throw "updateSlidesByID needs an equal number of tweets and slide IDs";
		}

		var correlated = {};

		ids_to_update.forEach(function(e, i, a) {
			var target = $("#" + e);
			target.html("<img src=\"" + getFullImage(tweets[i].user.profile_image_url) + "\"</img>");
			target.append("<q>" + tweets[i].text + "</q>");

			correlated[e] = tweets[i];
		});

		//returns an object that correlates modified slide IDs with their tweet objects		
		updateACS(correlated);
		return correlated;
	}

	function updateFixedBG(correlated) {
		//gets an array of slide IDs correlated to tweet objects (current state)

		var currentSlide = getCurrentSlideFromBody();
		//get the object associated with the current slide
		var currentTweet = correlated[currentSlide];
		var name = currentTweet.user.name.trim();
		var date = parseTwitterDate(currentTweet.user.created_at);
		var time = date.toLocaleTimeString();
		var match = /(?:a|p)m/i;
		var ampm = time.match(match); // save am/pm 
		time = time.replace(match, ""); // remove am/pm
		//time = time.replace(/^.+\:(\d\d)/, ""); //remove seconds
		fixedBGData = {
			name: name,
			time: time,
			ampm: ampm,
			date: date.toLocaleDateString()
		};
		$("#fixedbg").html(fixedBGTemplate(fixedBGData));


		//allIDs array should correspond to the ajax results array
		function parseTwitterDate(text) {
			return new Date(Date.parse(text.replace(/( +)/, ' UTC$1')));
		}
	}

	//------------------ MAIN
	var allCurrentSlides = {};

	// SETTINGS	
	var COUNT = 100; // Number of tweets to fetch per AJAX call.
	var CYCLE_TIME = 2500; // Time between slides in ms
	var HISTORY_LEVEL = 5; // Age at which slides are overwritten.

	var timing; //the interval object set in setOrResetCycle

	var fixedBGData = {}; //data for the fixedbg template
	var fixedBGTemplate = Handlebars.compile($('#namedate').html());

	var p = new TweetPool(null, 15); //second arg is refill trigger (depth).
	var allSlides = getAllSlideIDs();
	var runtime = 0; //number of total slides shown.

	var split_by_space_or_quotes = /\w+|"[^"]*"/g;
	var searchtopics = searchterms.match(split_by_space_or_quotes);

	fetchNewTweets(searchtopics, COUNT, false, function(result, max) {
		//console.log("got results: ");
		//console.log(result);

		p.push(result); //initial filling of pool

		var update = updateSlidesByID(allSlides, p.getRandom(allSlides.length)); //initial populating of all slides

		updateFixedBG(allCurrentSlides);

		window.setTimeout(function() {
			$("#loadingscreen").fadeOut();
			setOrResetCycle(CYCLE_TIME);
		}, 500); //add a little extra to be safe

	});

	var previous_slide = 0;

	$(document).on('impress:stepleave', function() {
		// update the header with info from the next slide.
		updateFixedBG(allCurrentSlides);

		runtime++;

		// todo: Give each tweet object a "seen" variable, and only refresh slides that have been seen.
		// this should fix the case where a user skips forward or backward, and unseen slides are replaced.

		if (runtime > HISTORY_LEVEL) { // Don't start refreshing slides we haven't seen.
			window.setTimeout(function() { // Refresh the slide HISTORY_LEVEL slides back with a new tweet
				var currentSlideNum = getCurrentSlideFromBody().match(/\d+/); //get the numerical portion only
				var numSlides = allSlides.length;
				var slideToUpdate = (((currentSlideNum - HISTORY_LEVEL) + numSlides) % numSlides) + 1; //look back 5 slides.
				// Javascript is weird and evals ie. (-4 % 15) as -4 instead of expected 11, 
				// so we add allSlides.length after subtracting.
				// ie. ((current - history) + length) % length) + 1

				var update = updateSlidesByID(["s" + slideToUpdate], p.getRandom());
			}, 1000);
		}
	});

	$(document).on('impress:stepenter', function() {

	});

	$(document).on('impress:keypress', function() {
		//reset the cycle timer if someone changes slides manually.
		//keypress event is added in to the impress source and may break if impress is updated.
		setOrResetCycle(CYCLE_TIME);
	});

	$(document).on('impress:mouseclick', function() {
		//reset the cycle timer if someone changes slides manually.
		//mouseclick event is added in to the impress source and may break if impress is updated.
		setOrResetCycle(CYCLE_TIME);
	});

	$(document).on("TweetPool:needrefill", function() {
		console.log("Refilling tweet pool.");
		fetchNewTweets(searchtopics, COUNT, false, function(result, max) {
			p.push(result);
		});
	});

	return {};
});