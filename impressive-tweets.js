//== refactor agenda ==

//-- I want to be able to replace the content of any slide in place --
//-- I want to dynamically reload slides, one at a time, without load screens --

// Get 100 tweets per topic. keep at (num slides) for testing.

// Extract pickSome from fetchNewTweets so we can use it when updating
// a single slide.

// a method updateSlidesByID(), taking an array of the slide IDs to update,
// and an array of tweets to do it with. 
// populates the specified slides with the tweets, then
// returns a correlated array of the changes. (slide ID to tweet object)
// this replaces populateSlides().

// Main, instead of calling fetchNewTweets then calling populateSlides to 
// populate all slides at once, calls fetch to intially
// fill a tweet pool, then calls pickSome() passing in the desired number of 
// tweets (num slides) to get an assortment, and finally passes those results to
// updateSlidesByID(), along with getAllSlideIDs.

// maintain and update the main correlated array every time updateSlidesByID is 
// called, for use by updateFixedBG.

// a function to maintain the tweet pool, refreshing it as needed.


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
			if (that.pool.length >= howmany) {
				// return howmany tweets
				var result = [];

				for (var i = 0; i < howmany; i += 1) {
					var rand = randomIntFromInterval(0, that.pool.length-1);
					result.push(that.pool[rand]);
					that.pool.splice(rand, 1);
				}

				that.checkDepth();

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
			that.checkDepth();
			return pool;
		};

		this.checkDepth = function() {
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
					url: "https://limitless-river-8379.herokuapp.com/1.1/search/tweets.json?q=" +
						topics[i] + "&result_type=recent&count=" + matches + "&langage=en",

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
						//console.log("success");
					},

					error: function() {
						console.log("one of the ajax calls errored out.");
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
				} else {
					console.log("removed an empty element");
				}
			});
			return result;
		}
	}

	function selectRandomTweet(arr, howmany) {
		//Pick an assortment of 'howmany' items from the array, unless the array is smaller than howmany,
		//in which case it just returns the original array.


		if (howmany > arr.length) {
			//no point in selecting if we don't have enough to begin with
			console.log("The pool couldn't grab everything you requested. Returning what we have.");
			return arr;
		} else {
			//for now just pick a random assortment
			var result = [];
			for (var i = 0; i < howmany; i += 1) {

				pick = randomIntFromInterval(0, arr.length - 1);
				result.push(arr[pick]);
				arr.splice(i, 1); // remove the result so we don't select it again
			}
			return result;
		}
	}

	// function updateTweets() {
	// 	$("#loadingscreen").fadeIn(100);
	// 	fetchNewTweets(searchtopics, COUNT, false, function(result, max) {
	// 		allCurrentSlides = populateSlides(result);
	// 		updateFixedBG(allCurrentSlides);
	// 		window.setTimeout(function() {
	// 			$("#loadingscreen").fadeOut(100);
	// 			setOrResetCycle(cycleTimer);
	// 		}, 500);

	// 	});
	// }

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
		return correlated;
	}

	function updateFixedBG(correlated) {
		//gets an array of slide IDs correlated to tweet objects (current state)

		//relevant object properties:
		// .user.name
		// .user.created_at

		//get the current slide
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
		$('#fixedbg').find('#name').text(name);
		$('#fixedbg').find('#time').text(time);
		$('#fixedbg').find('#ampm').text(ampm);
		$('#fixedbg').find('#date').text(date.toLocaleDateString());

		//allIDs array should correspond to the ajax results array
		function parseTwitterDate(text) {
			return new Date(Date.parse(text.replace(/( +)/, ' UTC$1')));
		}
	}

	//------------------ MAIN
	var allCurrentSlides = {};

	function updateACS(newUpdate) {
		$.extend(true, allCurrentSlides, newUpdate);
	}

	var COUNT = 15; //the number of slides.
	var cycleTimer = 2500; //time between slides in ms
	var timing;

	var p = new TweetPool(null, 5); //second arg is when to refill.


	var searchtopics = searchterms.split(" ");

	fetchNewTweets(searchtopics, COUNT, false, function(result, max) {
		//console.log("got results: ");
		//console.log(result);

		p.push(result); //initial filling of pool

		var allslides = getAllSlideIDs();
		var update = updateSlidesByID(allslides, p.getRandom(allslides.length)); //initial populating of all slides
		
		updateACS(update); //update the list used by fixedBG
		updateFixedBG(allCurrentSlides);

		window.setTimeout(function() {
			$("#loadingscreen").fadeOut();
			setOrResetCycle(cycleTimer);
		}, 500); //add a little extra to be safe

	});

	//todo: change these eventlisteners to $(document).on?
	window.addEventListener('impress:stepleave', function() {
		// update the header with info from the current slide.
		updateFixedBG(allCurrentSlides);
		if (getCurrentSlideFromBody() == ("s" + COUNT)) {
			window.setTimeout(updateTweets, cycleTimer); //wait for the last slide to finish
		}
	});

	window.addEventListener('impress:keypress', function() {
		//reset the cycle timer if someone changes slides manually.
		//keypress event is manually added in and may break if impress is updated.
		setOrResetCycle(cycleTimer);

		//below is for debugging -- repopulate all slides on keypress
		//updateTweets();
	});

	$(document).on("TweetPool:needrefill", function() {
		console.log("Refilling tweet pool.");
		fetchNewTweets(searchtopics, COUNT, false, function(result, max) {
			p.push(result); 
		});
	});

	return {};
});