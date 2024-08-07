import React from 'react';
import { MapContainer, TileLayer, Polygon, FeatureGroup, Popup} from 'react-leaflet'
import { EditControl } from "react-leaflet-draw";
import Autosuggest from 'react-autosuggest';
import '../index.css';
import helpers from'./helpers'

class DriftersExplore extends React.Component {

	constructor(props) {
		document.title = 'Argovis - Explore drifters'
		super(props);

		let q = new URLSearchParams(window.location.search) // parse out query string

		// limits for polygon / time coupling
		this.minDays = 0 // note the url construction always allows for one extra day than endDate-startDate
		this.maxDays = 365
		this.minArea = 100000
		this.maxArea = 1000000
		this.defaultDayspan = 0

		this.defaultPolygon = [[-62.57812500000001,52.482780222078226],[-84.37500000000001,34.016241889667036],[-87.18750000000001,15.623036831528264],[-64.33593750000001,13.923403897723347],[-40.42968750000001,46.07323062540835],[-62.57812500000001,52.482780222078226]]
		// default state, pulling in query string specifications
		this.state = {
			observingEntity: false,
			apiKey: localStorage.getItem('apiKey') ? localStorage.getItem('apiKey') : 'guest',
			wmoSuggestions: [],
			platformSuggestions: [],
			wmo: q.has('wmo') ? q.get('wmo') : '',
			platform: q.has('platform') ? q.get('platform') : '',
			refreshData: false,
			points: [],
			polygon: q.has('polygon') ? JSON.parse(q.get('polygon')) : this.defaultPolygon,
			interpolated_polygon: q.has('polygon') ? helpers.insertPointsInPolygon(JSON.parse(q.get('polygon'))) : helpers.insertPointsInPolygon(this.defaultPolygon),
			urls: [],
			centerlon: q.has('centerlon') ? parseFloat(q.get('centerlon')) : -70,
			mapkey: Math.random()
		}
		this.state.maxDayspan = helpers.calculateDayspan.bind(this)(this.state)

		helpers.mungeTime.bind(this)(q, this.state.maxDayspan, '2020-01-01')

        // some other useful class variables
        this.fgRef = React.createRef()
        this.formRef = React.createRef()
        this.wmoRef = React.createRef()
        this.platformRef = React.createRef()
		this.statusReporting = React.createRef()
		this.reautofocus = null
        this.apiPrefix = 'https://argovis-drifters.colorado.edu/'
        this.vocab = {}
        this.lookupLabel = {}
        this.dataset = 'drifter'
        this.customQueryParams =  ['startDate', 'endDate', 'polygon', 'wmo', 'platform', 'centerlon']

        // populate vocabularies, and trigger first render
        let vocabURLs = [this.apiPrefix + 'drifters/vocabulary?parameter=wmo', this.apiPrefix + 'drifters/vocabulary?parameter=platform']
		Promise.all(vocabURLs.map(x => fetch(x, {headers:{'x-argokey': this.state.apiKey}}))).then(responses => {
			Promise.all(responses.map(res => res.json())).then(data => {
				if(data[0].hasOwnProperty('code') && data[0].code === 401){
					helpers.manageStatus.bind(this)('error', 'Invalid API key; see the "Get a free API key" link below.')
				} else {
					this.vocab['wmo'] = data[0].map(x => String(x))
					this.vocab['platform'] = data[1]
					this.setState({refreshData:true})
				}
			})
		})
	}

    componentDidUpdate(prevProps, prevState, snapshot){
    	helpers.componentDidUpdate.bind(this)()
    }

	refreshMap(state){
		helpers.refreshMap.bind(this)(state)
	}

    lookingForEntity(state){
    	// return true if any token, valid or not, is specified for any entity query string parameter
    	return Boolean(state.wmo || state.platform)
    }

    generateURLs(state){
    	if(state.wmo !== ''){
    		return [this.apiPrefix +'drifters?compression=minimal&wmo=' + state.wmo]
    	} else if (state.platform !== ''){
    		return [this.apiPrefix +'drifters?compression=minimal&platform=' + state.platform]
    	} else {
    		return [helpers.generateTemporoSpatialURL.bind(this)(this.apiPrefix, 'drifters', state)]
    	}
    }	

	mapmarkers(points, state){
		return helpers.circlefy.bind(this)(points, state)
	}

    chooseColor(point){
    	return 'black'
    }

    genTooltip(point, state){
    	// given an array <point> corresponding to a single point returned by an API data route with compression=minimal,
    	// return the jsx for an appropriate tooltip for this point.

    	let regionLink = helpers.genRegionLink(state.polygon, state.startDate, state.endDate, state.centerlon, 'drifters')

    	return(
		    <Popup>
		      ID: {point[0]} <br />
		      Long / Lat: {helpers.mungePrecision(point[1])} / {helpers.mungePrecision(point[2])} <br />
		      Date: {point[3]} <br />
		      <a target="_blank" rel="noreferrer" href={'/plots/drifters?showAll=true&wmo='+point[4]+'&centerlon='+this.state.centerlon}>{'WMO ' + point[4] + ' page'}</a><br />
		      <a target="_blank" rel="noreferrer" href={'/plots/drifters?showAll=true&platform='+point[0].split('_')[0]+'&centerlon='+this.state.centerlon}>{'Drifter platform ' + point[0].split('_')[0] + ' Page'}</a>
		      {regionLink}
		    </Popup>
    	)
    }

    dateRangeMultiplyer(s){
    	// allowed date range will be multiplied by this much, as a function of the mutated state s
    	return 1
    }

    toggleCoupling(s){
    	// if changing a toggle for this page needs to trigger a side effect on state, do so here.
    	return s
    }

	render(){
		console.log(this.state)
		return(
			<>
				<div style={{'width':'100vw', 'textAlign': 'center', 'padding':'0.5em', 'fontStyle':'italic'}} className='d-lg-none'>Use the right-hand scroll bar to scroll down for search controls</div>
				<div className='row' style={{'width':'100vw'}}>
					<div className='col-lg-3 order-last order-lg-first'>
						<fieldset ref={this.formRef}>
							<span id='statusBanner' ref={this.statusReporting} className='statusBanner busy'>Downloading...</span>
							<div className='mapSearchInputs scrollit' style={{'height':'90vh'}}>
								<h5>Explore Global Drifter Program</h5>
								<div className='verticalGroup'>
									<div className="form-floating mb-3">
										<input type="password" className="form-control" id="apiKey" value={this.state.apiKey} placeholder="" onInput={(v) => helpers.setToken.bind(this)('apiKey', v.target.value, null, true)}></input>
										<label htmlFor="apiKey">API Key</label>
										<div id="apiKeyHelpBlock" className="form-text">
						  					<a target="_blank" rel="noreferrer" href='https://argovis-keygen.colorado.edu/'>Get a free API key</a>
										</div>
									</div>
									<h6>Time Range</h6>
									<div className="form-floating mb-3">
										<input 
											type="date" 
											disabled={this.state.observingEntity} 
											className="form-control" 
											id="startDate" 
											value={this.state.startDate} 
											placeholder="" 
											onChange={v => helpers.setDate.bind(this)('startDate', v.target.valueAsNumber, this.state.maxDayspan, false, true)}
											onBlur={e => helpers.setDate.bind(this)('startDate', e.target.valueAsNumber, this.state.maxDayspan, false, false)}
											onKeyPress={e => {if(e.key==='Enter'){helpers.setDate.bind(this)('startDate', e.target.valueAsNumber, this.state.maxDayspan, false, false)}}}
										/>
										<label htmlFor="startDate">Start Date</label>
									</div>
									<div className="form-floating mb-3">
										<input 
											type="date" 
											disabled={this.state.observingEntity} 
											className="form-control" 
											id="startDate" 
											value={this.state.endDate} 
											placeholder="" 
											onChange={v => helpers.setDate.bind(this)('endDate', v.target.valueAsNumber, this.state.maxDayspan, false, true)}
											onBlur={e => helpers.setDate.bind(this)('endDate', e.target.valueAsNumber, this.state.maxDayspan, false, false)}
											onKeyPress={e => {if(e.key==='Enter'){helpers.setDate.bind(this)('endDate', e.target.valueAsNumber, this.state.maxDayspan, false, false)}}}
										/>
										<label htmlFor="endDate">End Date</label>
									</div>
									<div id="dateRangeHelp" className="form-text">
					  					<p>Max day range: {this.state.maxDayspan+1}</p>
									</div>
								</div>

								<h6>Map Center Longitude</h6>
									<div className="form-floating mb-3">
										<input 
											id="centerlon"
											type="text"
											disabled={this.state.observingEntity} 
											className="form-control" 
											placeholder="0" 
											value={this.state.centerlon} 
											onChange={e => {
												helpers.manageStatus.bind(this)('actionRequired', 'Hit return or click outside the current input to update.')
												this.setState({centerlon:e.target.value})}
											} 
											onBlur={e => {
												this.setState({centerlon: helpers.manageCenterlon(e.target.defaultValue), mapkey: Math.random(), refreshData: true})
											}}
											onKeyPress={e => {
												if(e.key==='Enter'){
													this.setState({centerlon: helpers.manageCenterlon(e.target.defaultValue), mapkey: Math.random(), refreshData: true})
												}
											}}
											aria-label="centerlon" 
											aria-describedby="basic-addon1"/>
										<label htmlFor="depth">Center longitude on [-180,180]</label>
									</div>

								<div className='verticalGroup'>
									<h6>Object Filters</h6>
									<div className="form-floating mb-3">
			      						<Autosuggest
									      	id='wmoAS'
									      	key='wmo'
									      	ref={this.wmoRef}
									        suggestions={this.state.wmoSuggestions}
									        onSuggestionsFetchRequested={helpers.onSuggestionsFetchRequested.bind(this, 'wmoSuggestions')}
									        onSuggestionsClearRequested={helpers.onSuggestionsClearRequested.bind(this, 'wmoSuggestions')}
									        getSuggestionValue={helpers.getSuggestionValue}
									        renderSuggestion={helpers.renderSuggestion.bind(this, 'wmo')}
									        inputProps={{placeholder: 'WMO ID', value: this.state.wmo, onChange: helpers.onAutosuggestChange.bind(this, 'Check value of WMO ID', 'wmo', this.wmoRef), id: 'wmo', disabled: Boolean(this.state.platform)}}
									        theme={{input: 'form-control', suggestionsList: 'list-group', suggestion: 'list-group-item'}}
			      						/>
									</div>

									<div className="form-floating mb-3">
			      						<Autosuggest
									      	id='platformAS'
									      	key='platform'
									      	ref={this.platformRef}
									        suggestions={this.state.platformSuggestions}
									        onSuggestionsFetchRequested={helpers.onSuggestionsFetchRequested.bind(this, 'platformSuggestions')}
									        onSuggestionsClearRequested={helpers.onSuggestionsClearRequested.bind(this, 'platformSuggestions')}
									        getSuggestionValue={helpers.getSuggestionValue}
									        renderSuggestion={helpers.renderSuggestion.bind(this, 'platform')}
									        inputProps={{placeholder: 'Platform ID', value: this.state.platform, onChange: helpers.onAutosuggestChange.bind(this, 'Check value of Platform ID', 'platform', this.platformRef), id: 'platform',  disabled: Boolean(this.state.wmo)}}
									        theme={{input: 'form-control', suggestionsList: 'list-group', suggestion: 'list-group-item'}}
			      						/>
									</div>
									<a className="btn btn-primary" href="/drifters" role="button">Reset Map</a>
								</div>
							</div>
						</fieldset>
					</div>

					{/*leaflet map*/}
					<div className='col-lg-9'>
						<MapContainer key={this.state.mapkey} center={[25, parseFloat(this.state.centerlon)]} maxBounds={[[-90,this.state.centerlon-180],[90,this.state.centerlon+180]]} zoomSnap={0.01} zoomDelta={1} zoom={2.05} minZoom={2.05} scrollWheelZoom={true}>
							<TileLayer
							attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
							url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
							/>
							<FeatureGroup ref={this.fgRef}>
								<EditControl
								position='topleft'
								onCreated={p => helpers.onPolyCreate.bind(this)(p)}
								onDeleted={p => helpers.onPolyDelete.bind(this)(this.defaultPolygon,p)}
								onDrawStop={p => helpers.onDrawStop.bind(this)(p)}
								onDrawStart={p => helpers.onDrawStart.bind(this)(p)}
								draw={{
									rectangle: false,
									circle: false,
									polyline: false,
									circlemarker: false,
									marker: false,
									polygon: this.state.observingEntity ? false: {
										shapeOptions: {
											fillOpacity: 0
										}
									}
								}}
								edit={{
									edit: false
								}}
								/>
								<Polygon key={Math.random()} positions={this.state.interpolated_polygon.map(x => [x[1],helpers.mutateLongitude(x[0], this.state.centerlon)])} fillOpacity={0}></Polygon>
							</FeatureGroup>
							{this.state.points}
						</MapContainer>
					</div>
				</div>
			</>
		)
	}
}

export default DriftersExplore